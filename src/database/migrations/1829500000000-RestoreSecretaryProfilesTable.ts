import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repairs a schema drift found in production (Railway) on 2026-10-19:
 * `secretary_profiles` was missing even though migration
 * 1765000000000-AddClinicRoleProfileTables (which creates it) is recorded as
 * executed, and its twin table `clinic_admin_profiles` — created by that same
 * migration — was present. 75 of 76 migrations were registered, the only
 * unregistered one being 1830 (which failed *because* of this).
 *
 * So the table wasn't "never created": it was created and later dropped
 * outside of any migration. 1830-EncryptCpfColumns was simply the first
 * migration since then to ALTER it, which is what surfaced the drift.
 *
 * Recreates it with the shape it would have had after 1765000000000 and
 * 1765100000000 ran (i.e. including the credential columns, with
 * `professionalId` already nullable and `cpf` still varchar(14) — 1830 is
 * what widens cpf to 64, and it runs right after this).
 *
 * Deliberately NOT a modification of 1765000000000: that migration is
 * already recorded in every environment and would never re-run. Repairing
 * drift needs its own forward migration.
 *
 * Fully idempotent (IF NOT EXISTS / existence checks throughout) so it is a
 * no-op in every environment where the table is intact — which is all of
 * them except the one being repaired.
 */
export class RestoreSecretaryProfilesTable1829500000000 implements MigrationInterface {
  name = 'RestoreSecretaryProfilesTable1829500000000';

  private async tableExists(queryRunner: QueryRunner, table: string): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [table],
    );
    return Number(rows[0].c) > 0;
  }

  private async constraintExists(
    queryRunner: QueryRunner,
    table: string,
    constraint: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS c FROM information_schema.table_constraints
       WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ?`,
      [table, constraint],
    );
    return Number(rows[0].c) > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existedBefore = await this.tableExists(queryRunner, 'secretary_profiles');

    if (existedBefore) {
      // Healthy environment: nothing to repair.
      return;
    }

    console.log(
      '[RestoreSecretaryProfilesTable] secretary_profiles is missing — recreating it (schema drift repair).',
    );

    // Column shape = post-1765000000000 + post-1765100000000, mirroring the
    // surviving clinic_admin_profiles table. `cpf` stays varchar(14) here;
    // migration 1830 widens it to 64 immediately after.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`secretary_profiles\` (
        \`id\` varchar(36) NOT NULL,
        \`professionalId\` varchar(36) NULL,
        \`clinicId\` varchar(36) NULL,
        \`name\` varchar(255) NOT NULL DEFAULT '',
        \`email\` varchar(255) NULL,
        \`password\` varchar(255) NULL,
        \`phone\` varchar(20) NOT NULL DEFAULT '',
        \`profileImage\` varchar(500) NULL,
        \`gender\` varchar(50) NULL,
        \`birthDate\` date NULL,
        \`cpf\` varchar(14) NULL,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_secretary_profiles_professional\` (\`professionalId\`),
        UNIQUE KEY \`UQ_secretary_profiles_email\` (\`email\`),
        KEY \`IDX_secretary_profiles_clinic\` (\`clinicId\`)
      ) ENGINE=InnoDB;
    `);

    // ON DELETE SET NULL on both, matching the final state after
    // 1765100000000 replaced the original CASCADE on professionalId.
    if (
      !(await this.constraintExists(
        queryRunner,
        'secretary_profiles',
        'FK_secretary_profiles_professional',
      ))
    ) {
      await queryRunner.query(
        'ALTER TABLE `secretary_profiles` ADD CONSTRAINT `FK_secretary_profiles_professional` ' +
          'FOREIGN KEY (`professionalId`) REFERENCES `doctors`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;',
      );
    }
    if (
      !(await this.constraintExists(
        queryRunner,
        'secretary_profiles',
        'FK_secretary_profiles_clinic',
      ))
    ) {
      await queryRunner.query(
        'ALTER TABLE `secretary_profiles` ADD CONSTRAINT `FK_secretary_profiles_clinic` ' +
          'FOREIGN KEY (`clinicId`) REFERENCES `clinics`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;',
      );
    }

    // Rebuild the rows from the source of truth the app still has:
    // active secretary memberships, enriched from the professional record.
    // Same projection the original migrations used (1765000000000 for the
    // membership pivot, 1765100000000 for the credential copy), collapsed
    // into one INSERT..SELECT.
    //
    // DISTINCT via GROUP BY professionalId: UQ_secretary_profiles_professional
    // allows only one row per professional, and a professional can hold a
    // secretary membership in more than one clinic. MIN(clinicId) picks one
    // deterministically — exactly what 1765000000000 did.
    //
    // Email is copied even though UQ_secretary_profiles_email is unique:
    // a professional's email is already unique in `doctors`, so this can't
    // collide. NULLIF guards the one case MySQL would reject — several rows
    // with an empty-string email are a duplicate, several NULLs are not.
    await queryRunner.query(`
      INSERT INTO \`secretary_profiles\`
        (\`id\`, \`professionalId\`, \`clinicId\`, \`name\`, \`email\`, \`password\`,
         \`phone\`, \`profileImage\`, \`gender\`, \`birthDate\`, \`cpf\`)
      SELECT
        UUID(),
        d.id,
        source.clinicId,
        COALESCE(d.name, ''),
        NULLIF(d.email, ''),
        d.password,
        COALESCE(d.phone, ''),
        d.profileImage,
        d.gender,
        d.birthDate,
        d.cpf
      FROM (
        SELECT cm.professionalId, MIN(cm.clinicId) AS clinicId
        FROM \`clinic_memberships\` cm
        WHERE cm.isActive = 1 AND cm.role = 'secretary'
        GROUP BY cm.professionalId
      ) source
      INNER JOIN \`doctors\` d ON d.id = source.professionalId;
    `);

    const restored = await queryRunner.query('SELECT COUNT(*) AS c FROM `secretary_profiles`');
    console.log(
      `[RestoreSecretaryProfilesTable] recreated with ${restored[0].c} row(s) rebuilt from active secretary memberships.`,
    );
  }

  public async down(): Promise<void> {
    // Intentionally a no-op. This migration repairs drift by restoring a
    // table that 1765000000000 owns; dropping it here would re-break the
    // very schema that migration is responsible for, and would destroy rows
    // in environments that were never broken. Reverting past this point is
    // 1765000000000's `down`, not this one's.
  }
}
