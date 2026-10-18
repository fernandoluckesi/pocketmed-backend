import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a digits-only generated column `phoneNormalized` to `patients` and
 * `doctors`, plus a (non-unique) index on it, so the phone availability check
 * used by the profile edit screen is a direct indexed lookup instead of
 * loading every row and comparing in JS.
 *
 * Non-unique on purpose: phone numbers may legitimately repeat in legacy data
 * (and across shadow accounts), so uniqueness stays enforced in application
 * code — the index is purely for lookup speed. Requires MySQL 8 (REGEXP_REPLACE
 * + STORED generated columns), which is what this project runs.
 */
export class AddPhoneNormalizedIndex1829000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE patients
        ADD COLUMN phoneNormalized VARCHAR(20)
        GENERATED ALWAYS AS (REGEXP_REPLACE(phone, '[^0-9]', '')) STORED
    `);
    await queryRunner.query(
      `CREATE INDEX IDX_patients_phone_normalized ON patients (phoneNormalized)`,
    );

    await queryRunner.query(`
      ALTER TABLE doctors
        ADD COLUMN phoneNormalized VARCHAR(20)
        GENERATED ALWAYS AS (REGEXP_REPLACE(phone, '[^0-9]', '')) STORED
    `);
    await queryRunner.query(
      `CREATE INDEX IDX_doctors_phone_normalized ON doctors (phoneNormalized)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IDX_doctors_phone_normalized ON doctors`);
    await queryRunner.query(`ALTER TABLE doctors DROP COLUMN phoneNormalized`);
    await queryRunner.query(`DROP INDEX IDX_patients_phone_normalized ON patients`);
    await queryRunner.query(`ALTER TABLE patients DROP COLUMN phoneNormalized`);
  }
}
