import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the subscription plan to clinics: which of the 5 fixed plans
 * (starter/plus/pro/premium/enterprise) the clinic is on, plus how many
 * extra professional seats it bought beyond the plan's included limit.
 * Additive and non-destructive; existing clinics default to 'starter'.
 */
export class AddSubscriptionToClinics1803000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clinics
        ADD COLUMN planId VARCHAR(20) NOT NULL DEFAULT 'starter',
        ADD COLUMN additionalProfessionals INT NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clinics
        DROP COLUMN planId,
        DROP COLUMN additionalProfessionals
    `);
  }
}
