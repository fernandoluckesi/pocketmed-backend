import { MigrationInterface, QueryRunner } from 'typeorm';
import { encryptCpf, decryptCpf, isEncryptedCpf } from '../../common/cpf-encryption.util';

/**
 * Encrypts every cpf (and the one CPF snapshot) column at rest, using the
 * same deterministic transformer now applied on the entities
 * (Patient/Doctor/SecretaryProfile/ClinicAdminProfile.cpf,
 * Report.patientCpfSnapshot — see src/common/cpf-encryption.util.ts).
 *
 * Requires CPF_ENCRYPTION_KEY to already be set wherever this runs — fails
 * fast (via cpf-encryption.util's own check) rather than silently writing
 * garbage or skipping rows if it's missing.
 *
 * Widens each column first (encrypted values are ~44 chars vs. the original
 * 11-14), then re-encrypts row by row in JS (not pure SQL) so the encryption
 * logic is guaranteed identical to what the running app uses — a mismatch
 * here would make rows unreadable or silently defeat the uniqueness check.
 * Idempotent: `encryptCpf`/`isEncryptedCpf` skip values already in the
 * "enc:" format, so re-running this migration (e.g. a retried deploy) is
 * safe.
 */
export class EncryptCpfColumns1830000000000 implements MigrationInterface {
  private readonly targets: Array<{ table: string; column: string; nullable: boolean }> = [
    { table: 'patients', column: 'cpf', nullable: true },
    { table: 'doctors', column: 'cpf', nullable: false },
    { table: 'secretary_profiles', column: 'cpf', nullable: true },
    { table: 'clinic_admin_profiles', column: 'cpf', nullable: true },
    { table: 'reports', column: 'patientCpfSnapshot', nullable: true },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Patients only: the generated `cpfUnique` column mirrors `cpf` — drop
    //    it and its unique index before widening `cpf`, re-add at the end.
    await queryRunner.query(`DROP INDEX IDX_patients_cpf_unique ON patients`);
    await queryRunner.query(`ALTER TABLE patients DROP COLUMN cpfUnique`);

    // 2) Widen every column to fit the encrypted form.
    for (const { table, column, nullable } of this.targets) {
      await queryRunner.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` VARCHAR(64) ${nullable ? 'NULL' : 'NOT NULL'}`,
      );
    }

    // 3) Encrypt existing plaintext values, table by table.
    for (const { table, column } of this.targets) {
      const rows: Array<{ id: string; value: string }> = await queryRunner.query(
        `SELECT id, \`${column}\` AS value FROM \`${table}\` WHERE \`${column}\` IS NOT NULL AND \`${column}\` <> ''`,
      );
      for (const row of rows) {
        if (isEncryptedCpf(row.value)) continue; // already migrated (safe re-run)
        const encrypted = encryptCpf(row.value);
        await queryRunner.query(`UPDATE \`${table}\` SET \`${column}\` = ? WHERE id = ?`, [
          encrypted,
          row.id,
        ]);
      }
    }

    // 4) Patients: clear duplicates that only became duplicates now.
    //    Encryption canonicalizes to digits first (see canonicalizeCpf in
    //    cpf-encryption.util.ts), so two real patients stored as
    //    '390.533.447-05' and '39053344705' were distinct strings before this
    //    migration — and are the same ciphertext after it. Migration 1828's
    //    dedupe couldn't have caught that pair. Without this step, re-adding
    //    the unique index below would fail halfway through the deploy, with
    //    the CPFs already encrypted and the constraint gone.
    //    Same rule as 1828: the earliest-created row keeps its CPF.
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

    // 5) Patients: re-add the generated column + unique index at the new width.
    await queryRunner.query(`
      ALTER TABLE patients
        ADD COLUMN cpfUnique VARCHAR(64)
        GENERATED ALWAYS AS (
          CASE WHEN isShadow = 0 AND cpf <> '' THEN cpf ELSE NULL END
        ) STORED
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IDX_patients_cpf_unique ON patients (cpfUnique)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IDX_patients_cpf_unique ON patients`);
    await queryRunner.query(`ALTER TABLE patients DROP COLUMN cpfUnique`);

    for (const { table, column } of this.targets) {
      const rows: Array<{ id: string; value: string }> = await queryRunner.query(
        `SELECT id, \`${column}\` AS value FROM \`${table}\` WHERE \`${column}\` IS NOT NULL AND \`${column}\` <> ''`,
      );
      for (const row of rows) {
        if (!isEncryptedCpf(row.value)) continue;
        const decrypted = decryptCpf(row.value);
        await queryRunner.query(`UPDATE \`${table}\` SET \`${column}\` = ? WHERE id = ?`, [
          decrypted,
          row.id,
        ]);
      }
    }

    await queryRunner.query(`ALTER TABLE patients MODIFY COLUMN cpf VARCHAR(11) NULL`);
    await queryRunner.query(`ALTER TABLE doctors MODIFY COLUMN cpf VARCHAR(14) NOT NULL`);
    await queryRunner.query(`ALTER TABLE secretary_profiles MODIFY COLUMN cpf VARCHAR(14) NULL`);
    await queryRunner.query(`ALTER TABLE clinic_admin_profiles MODIFY COLUMN cpf VARCHAR(14) NULL`);
    await queryRunner.query(
      `ALTER TABLE reports MODIFY COLUMN patientCpfSnapshot VARCHAR(14) NULL`,
    );

    await queryRunner.query(`
      ALTER TABLE patients
        ADD COLUMN cpfUnique VARCHAR(11)
        GENERATED ALWAYS AS (
          CASE WHEN isShadow = 0 AND cpf <> '' THEN cpf ELSE NULL END
        ) STORED
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IDX_patients_cpf_unique ON patients (cpfUnique)
    `);
  }
}
