import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `'sent'` to `prescriptions.status` — reached by "Enviar sem assinatura
 * digital" (delivered to the patient, never signed). A signed document skips
 * straight to `'signed'` instead (signing implies delivery in this flow), so
 * no other table needs this value yet.
 */
export class AddSentStatusToPrescriptions1813000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`prescriptions\`
      MODIFY COLUMN \`status\` enum('draft','generated','sent','signed','canceled') NOT NULL DEFAULT 'draft'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`prescriptions\`
      MODIFY COLUMN \`status\` enum('draft','generated','signed','canceled') NOT NULL DEFAULT 'draft'
    `);
  }
}
