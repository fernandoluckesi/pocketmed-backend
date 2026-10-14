import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Receitas already had convenioId/procedureCode/guideNumber, but the
 * creation form never captured them. These three close the rest of what a
 * convênio guide needs at the point of attendance: the authorization number
 * and the patient's plan/card with that operadora.
 */
export class AddGuideFieldsToRevenues1822000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`financial_revenues\`
      ADD COLUMN \`authorizationNumber\` VARCHAR(50) NULL,
      ADD COLUMN \`insurancePlanName\` VARCHAR(100) NULL,
      ADD COLUMN \`insuranceCardNumber\` VARCHAR(50) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`financial_revenues\`
      DROP COLUMN \`authorizationNumber\`,
      DROP COLUMN \`insurancePlanName\`,
      DROP COLUMN \`insuranceCardNumber\`
    `);
  }
}
