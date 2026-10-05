import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `'sent'` to `reports.status` — same reasoning as the equivalent
 * `prescriptions` migration: reached by "Enviar sem assinatura digital"
 * (delivered to the patient, never signed). A signed report skips straight
 * to `'signed'` instead (signing implies delivery in this flow).
 */
export class AddSentStatusToReports1815000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`reports\`
      MODIFY COLUMN \`status\` enum('draft','generated','sent','signed','canceled') NOT NULL DEFAULT 'draft'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`reports\`
      MODIFY COLUMN \`status\` enum('draft','generated','signed','canceled') NOT NULL DEFAULT 'draft'
    `);
  }
}
