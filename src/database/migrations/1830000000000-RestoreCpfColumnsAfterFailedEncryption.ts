import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Undoes the schema damage left by a withdrawn CPF-at-rest encryption
 * attempt (2026-10-19).
 *
 * What happened: a migration meant to encrypt every CPF column widened the
 * columns to varchar(64) and dropped the `cpfUnique` generated column (plus
 * its unique index) before failing partway through, on a missing table.
 * MySQL DDL isn't transactional, so nothing rolled back. The encryption step
 * never ran, so **all CPFs are still plaintext** — there is nothing to
 * decrypt here, which is why this is a pure schema repair.
 *
 * The encryption approach was then dropped on purpose: a lost
 * CPF_ENCRYPTION_KEY would make every stored CPF permanently unreadable, a
 * worse operational risk than the at-rest exposure it mitigated (the DB is
 * not publicly reachable once item #3 is closed, and CPF stays protected in
 * transit and by the API's own access controls).
 *
 * Restores:
 *  - the original column widths (varchar(11)/varchar(14)), and
 *  - `patients.cpfUnique` + `IDX_patients_cpf_unique`, the DB-level
 *    uniqueness safety net from 1828000000000-AddUniquePatientCpf, which the
 *    failed run removed and left absent.
 *
 * Every step is existence-checked, because the starting state differs per
 * environment: production is half-migrated, while environments that never
 * got the bad deploy are already correct (there, this is a no-op).
 */
export class RestoreCpfColumnsAfterFailedEncryption1830000000000 implements MigrationInterface {
  name = 'RestoreCpfColumnsAfterFailedEncryption1830000000000';

  /** Original widths, as declared on the entities. */
  private readonly targets: Array<{
    table: string;
    column: string;
    definition: string;
  }> = [
    { table: 'patients', column: 'cpf', definition: 'VARCHAR(11) NULL' },
    { table: 'doctors', column: 'cpf', definition: 'VARCHAR(14) NOT NULL' },
    { table: 'secretary_profiles', column: 'cpf', definition: 'VARCHAR(14) NULL' },
    { table: 'clinic_admin_profiles', column: 'cpf', definition: 'VARCHAR(14) NULL' },
    { table: 'reports', column: 'patientCpfSnapshot', definition: 'VARCHAR(14) NULL' },
  ];

  private async tableExists(queryRunner: QueryRunner, table: string): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [table],
    );
    return Number(rows[0].c) > 0;
  }

  private async columnExists(
    queryRunner: QueryRunner,
    table: string,
    column: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [table, column],
    );
    return Number(rows[0].c) > 0;
  }

  private async indexExists(
    queryRunner: QueryRunner,
    table: string,
    index: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
      [table, index],
    );
    return Number(rows[0].c) > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Safety check. If any CPF is still in the "enc:" format, the
    //    encryption step DID run somewhere and narrowing the columns would
    //    truncate ciphertext into unrecoverable garbage. Refuse instead.
    //    Expected to find nothing — the failed run never reached that step.
    for (const { table, column } of this.targets) {
      if (!(await this.tableExists(queryRunner, table))) continue;
      const encrypted = await queryRunner.query(
        `SELECT COUNT(*) AS c FROM \`${table}\` WHERE \`${column}\` LIKE 'enc:%'`,
      );
      if (Number(encrypted[0].c) > 0) {
        throw new Error(
          `${table}.${column} still holds ${encrypted[0].c} encrypted value(s). ` +
            `Narrowing the column now would permanently truncate them. Decrypt with the ` +
            `CPF_ENCRYPTION_KEY used at the time before running this migration.`,
        );
      }
    }

    // 2) Drop the generated column + index before touching `cpf`: MySQL
    //    refuses to modify a column that a STORED generated column reads
    //    from. Recreated in step 4 at the original width.
    if (await this.indexExists(queryRunner, 'patients', 'IDX_patients_cpf_unique')) {
      await queryRunner.query(`DROP INDEX IDX_patients_cpf_unique ON patients`);
    }
    if (await this.columnExists(queryRunner, 'patients', 'cpfUnique')) {
      await queryRunner.query(`ALTER TABLE patients DROP COLUMN cpfUnique`);
    }

    // 3) Restore the original widths. Narrowing is safe: values are
    //    plaintext CPFs (<= 14 chars), guaranteed by step 1.
    for (const { table, column, definition } of this.targets) {
      if (!(await this.tableExists(queryRunner, table))) {
        // Schema drift handled by its own repair migration; skipping keeps
        // this one from failing the deploy over an unrelated problem.
        console.warn(
          `[RestoreCpfColumns] table "${table}" not found — skipping ${table}.${column}.`,
        );
        continue;
      }
      await queryRunner.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${definition}`);
    }

    // 4) Rebuild the uniqueness safety net exactly as 1828 defined it.
    //    Duplicates are cleared first: the index was absent for however long
    //    production ran in the broken state, so a duplicate CPF could have
    //    been inserted in the meantime. Oldest row keeps its CPF, same rule
    //    1828 used.
    await queryRunner.query(`
      UPDATE patients p
      JOIN (
        SELECT cpf, MIN(createdAt) AS keepCreatedAt
        FROM patients
        WHERE isShadow = 0 AND cpf IS NOT NULL AND cpf <> ''
        GROUP BY cpf
        HAVING COUNT(*) > 1
      ) dups ON p.cpf = dups.cpf
      SET p.cpf = NULL
      WHERE p.isShadow = 0
        AND p.cpf IS NOT NULL
        AND p.createdAt <> dups.keepCreatedAt
    `);

    if (!(await this.columnExists(queryRunner, 'patients', 'cpfUnique'))) {
      await queryRunner.query(`
        ALTER TABLE patients
          ADD COLUMN cpfUnique VARCHAR(11)
          GENERATED ALWAYS AS (
            CASE WHEN isShadow = 0 AND cpf <> '' THEN cpf ELSE NULL END
          ) STORED
      `);
    }
    if (!(await this.indexExists(queryRunner, 'patients', 'IDX_patients_cpf_unique'))) {
      await queryRunner.query(`
        CREATE UNIQUE INDEX IDX_patients_cpf_unique ON patients (cpfUnique)
      `);
    }
  }

  public async down(): Promise<void> {
    // Intentionally a no-op. This migration restores the schema to what the
    // entities already declare (and what 1828 established); "reverting" it
    // would mean re-widening the columns and dropping the uniqueness index
    // again, recreating the broken state for no reason.
  }
}
