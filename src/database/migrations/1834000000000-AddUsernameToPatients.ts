import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a `username` to patients — required going forward for mobile
 * self-registration (`POST /auth/register/patient`), nullable at the DB
 * level so shadow patients (created by a doctor, never self-registered)
 * and pre-existing rows are unaffected.
 *
 * Unlike CPF (migration 1828), no generated-column workaround is needed
 * here: every patient that DOES have a username must be globally unique,
 * there's no "shadow accounts may share a value" carve-out, so a plain
 * UNIQUE index on the column is enough — MySQL allows multiple NULLs in a
 * UNIQUE index, which is exactly what every username-less patient needs.
 */
export class AddUsernameToPatients1834000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE patients
        ADD COLUMN username VARCHAR(30) NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IDX_patients_username_unique ON patients (username)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IDX_patients_username_unique ON patients`);
    await queryRunner.query(`ALTER TABLE patients DROP COLUMN username`);
  }
}
