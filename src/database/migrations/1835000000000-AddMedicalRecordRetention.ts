import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes account deletion comply with the medical-record retention duty
 * (CFM Res. 1.821/2007: 20 years from the last entry) while still honouring
 * the LGPD right to erasure — the reconciliation the Privacy Policy §7
 * already promises.
 *
 * Before this migration, `deleteAccount` hard-deleted everything and the
 * clinical entities carried `onDelete: CASCADE` from `Patient`, so
 * prescriptions, reports, certificates and exam requests were destroyed with
 * the account. The published policy said the opposite.
 *
 * What changes:
 *
 *  1. `patients`/`doctors` gain soft-delete columns. A deleted account whose
 *     clinical record must be kept is marked instead of removed; the record
 *     stays attached to it (which is what keeps the documents identifiable —
 *     only `reports` carries a full patient/doctor snapshot today).
 *
 *  2. `cpfUnique` is rebuilt to ignore soft-deleted rows. Without this, a
 *     person whose account was deleted could never sign up again: the unique
 *     index (migration 1828) would still see their retained CPF. The same
 *     applies to the e-mail/phone checks in `assertCpfAvailable` & co, handled
 *     in application code.
 *
 *  3. The clinical FKs drop CASCADE. With soft-delete the patient row survives,
 *     so CASCADE would not fire on a normal deletion — but leaving it in place
 *     would silently destroy the record on any future hard delete (e.g. the
 *     retention job, or a manual cleanup). RESTRICT makes that impossible by
 *     accident: the retention job deletes the documents explicitly, in order.
 *
 * Reversible: `down()` restores the original CASCADE behaviour and index, and
 * drops the new columns.
 */
export class AddMedicalRecordRetention1835000000000 implements MigrationInterface {
  name = 'AddMedicalRecordRetention1835000000000';

  /** Tables whose FK to `patients` must stop cascading. Each also has a
   * `dependentId` FK with the same problem. */
  private readonly clinicalTables = [
    'prescriptions',
    'reports',
    'certificates',
    'exam_requests',
  ] as const;

  private async columnExists(qr: QueryRunner, table: string, column: string): Promise<boolean> {
    const rows = await qr.query(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [table, column],
    );
    return Number(rows[0].c) > 0;
  }

  private async indexExists(qr: QueryRunner, table: string, index: string): Promise<boolean> {
    const rows = await qr.query(
      `SELECT COUNT(*) AS c FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
      [table, index],
    );
    return Number(rows[0].c) > 0;
  }

  private async tableExists(qr: QueryRunner, table: string): Promise<boolean> {
    const rows = await qr.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [table],
    );
    return Number(rows[0].c) > 0;
  }

  /**
   * Finds the actual FK constraint names pointing from `table`.`column` to
   * `referenced`. Names aren't hardcoded because TypeORM generates them
   * (FK_<hash>), so they differ per database.
   */
  private async findForeignKeys(
    qr: QueryRunner,
    table: string,
    column: string,
    referenced: string,
  ): Promise<string[]> {
    const rows: { CONSTRAINT_NAME: string }[] = await qr.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.key_column_usage
       WHERE table_schema = DATABASE() AND table_name = ?
         AND column_name = ? AND referenced_table_name = ?`,
      [table, column, referenced],
    );
    return rows.map((r) => r.CONSTRAINT_NAME);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1) Soft-delete + retention columns ────────────────────────────────
    for (const table of ['patients', 'doctors']) {
      if (!(await this.columnExists(queryRunner, table, 'deletedAt'))) {
        await queryRunner.query(
          `ALTER TABLE \`${table}\` ADD COLUMN \`deletedAt\` datetime(6) NULL`,
        );
      }
      if (!(await this.columnExists(queryRunner, table, 'deletionRequestedAt'))) {
        await queryRunner.query(
          `ALTER TABLE \`${table}\` ADD COLUMN \`deletionRequestedAt\` datetime NULL`,
        );
      }
      if (!(await this.columnExists(queryRunner, table, 'retentionUntil'))) {
        await queryRunner.query(`ALTER TABLE \`${table}\` ADD COLUMN \`retentionUntil\` date NULL`);
      }
      // Partial scans on "active rows only" become the common case once
      // soft-delete is in play.
      if (!(await this.indexExists(queryRunner, table, `IDX_${table}_deletedAt`))) {
        await queryRunner.query(
          `CREATE INDEX \`IDX_${table}_deletedAt\` ON \`${table}\` (\`deletedAt\`)`,
        );
      }
    }

    // ── 1b) Make the identifying contact columns nullable ─────────────────
    // `email` and `phone` are NOT NULL today, which would make the
    // anonymisation UPDATE fail outright. They must become nullable so a
    // retained record can have its contact details genuinely erased rather
    // than overwritten with a placeholder like "deleted@..." — a placeholder
    // would still be a value, and would keep occupying the unique index.
    //
    // Note `doctors.email` carries a UNIQUE constraint: MySQL allows multiple
    // NULLs in a unique index, so nulling it frees the address for a new
    // signup.
    await queryRunner.query(`ALTER TABLE \`patients\` MODIFY COLUMN \`email\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`patients\` MODIFY COLUMN \`phone\` varchar(20) NULL`);
    await queryRunner.query(`ALTER TABLE \`doctors\` MODIFY COLUMN \`email\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`doctors\` MODIFY COLUMN \`phone\` varchar(20) NULL`);

    // ── 2) Rebuild cpfUnique so a soft-deleted CPF frees up for re-signup ──
    // Generated columns can't be altered in place; drop and recreate.
    if (await this.indexExists(queryRunner, 'patients', 'IDX_patients_cpf_unique')) {
      await queryRunner.query(`DROP INDEX \`IDX_patients_cpf_unique\` ON \`patients\``);
    }
    if (await this.columnExists(queryRunner, 'patients', 'cpfUnique')) {
      await queryRunner.query(`ALTER TABLE \`patients\` DROP COLUMN \`cpfUnique\``);
    }
    await queryRunner.query(`
      ALTER TABLE \`patients\`
        ADD COLUMN \`cpfUnique\` varchar(11)
        GENERATED ALWAYS AS (
          CASE
            WHEN \`isShadow\` = 0 AND \`deletedAt\` IS NULL AND \`cpf\` <> ''
            THEN \`cpf\`
            ELSE NULL
          END
        ) STORED
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_patients_cpf_unique\` ON \`patients\` (\`cpfUnique\`)`,
    );

    // ── 3) Clinical FKs: CASCADE → RESTRICT ───────────────────────────────
    for (const table of this.clinicalTables) {
      if (!(await this.tableExists(queryRunner, table))) continue;

      for (const [column, referenced] of [
        ['patientId', 'patients'],
        ['dependentId', 'dependents'],
      ] as const) {
        if (!(await this.columnExists(queryRunner, table, column))) continue;

        const fks = await this.findForeignKeys(queryRunner, table, column, referenced);
        for (const fk of fks) {
          await queryRunner.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fk}\``);
          await queryRunner.query(
            `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${fk}\`
             FOREIGN KEY (\`${column}\`) REFERENCES \`${referenced}\`(\`id\`)
             ON DELETE RESTRICT ON UPDATE NO ACTION`,
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore CASCADE first: the columns being dropped below are what the new
    // index depends on.
    for (const table of this.clinicalTables) {
      if (!(await this.tableExists(queryRunner, table))) continue;

      for (const [column, referenced] of [
        ['patientId', 'patients'],
        ['dependentId', 'dependents'],
      ] as const) {
        if (!(await this.columnExists(queryRunner, table, column))) continue;

        const fks = await this.findForeignKeys(queryRunner, table, column, referenced);
        for (const fk of fks) {
          await queryRunner.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fk}\``);
          await queryRunner.query(
            `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${fk}\`
             FOREIGN KEY (\`${column}\`) REFERENCES \`${referenced}\`(\`id\`)
             ON DELETE CASCADE ON UPDATE NO ACTION`,
          );
        }
      }
    }

    // cpfUnique back to the 1828 definition (no deletedAt awareness).
    if (await this.indexExists(queryRunner, 'patients', 'IDX_patients_cpf_unique')) {
      await queryRunner.query(`DROP INDEX \`IDX_patients_cpf_unique\` ON \`patients\``);
    }
    if (await this.columnExists(queryRunner, 'patients', 'cpfUnique')) {
      await queryRunner.query(`ALTER TABLE \`patients\` DROP COLUMN \`cpfUnique\``);
    }
    await queryRunner.query(`
      ALTER TABLE \`patients\`
        ADD COLUMN \`cpfUnique\` varchar(11)
        GENERATED ALWAYS AS (
          CASE WHEN \`isShadow\` = 0 AND \`cpf\` <> '' THEN \`cpf\` ELSE NULL END
        ) STORED
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_patients_cpf_unique\` ON \`patients\` (\`cpfUnique\`)`,
    );

    // Restore NOT NULL on contact columns. Any anonymised row would block
    // this, so they are given a placeholder first — reverting this migration
    // after records were retained is inherently lossy, and this makes the
    // failure explicit rather than leaving the ALTER to fail mid-revert.
    await queryRunner.query(
      `UPDATE \`patients\` SET \`email\` = CONCAT('deleted-', \`id\`, '@invalid.local')
       WHERE \`email\` IS NULL`,
    );
    await queryRunner.query(`UPDATE \`patients\` SET \`phone\` = '' WHERE \`phone\` IS NULL`);
    await queryRunner.query(
      `UPDATE \`doctors\` SET \`email\` = CONCAT('deleted-', \`id\`, '@invalid.local')
       WHERE \`email\` IS NULL`,
    );
    await queryRunner.query(`UPDATE \`doctors\` SET \`phone\` = '' WHERE \`phone\` IS NULL`);
    await queryRunner.query(
      `ALTER TABLE \`patients\` MODIFY COLUMN \`email\` varchar(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`patients\` MODIFY COLUMN \`phone\` varchar(20) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`doctors\` MODIFY COLUMN \`email\` varchar(255) NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE \`doctors\` MODIFY COLUMN \`phone\` varchar(20) NOT NULL`);

    for (const table of ['patients', 'doctors']) {
      if (await this.indexExists(queryRunner, table, `IDX_${table}_deletedAt`)) {
        await queryRunner.query(`DROP INDEX \`IDX_${table}_deletedAt\` ON \`${table}\``);
      }
      for (const column of ['retentionUntil', 'deletionRequestedAt', 'deletedAt']) {
        if (await this.columnExists(queryRunner, table, column)) {
          await queryRunner.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
        }
      }
    }
  }
}
