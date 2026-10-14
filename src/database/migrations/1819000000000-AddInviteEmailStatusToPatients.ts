import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shadow patient creation used to roll back the whole patient record if the
 * welcome/invite email failed to send (e.g. Resend misconfigured or down),
 * turning an unrelated third-party outage into a hard failure of patient
 * registration. These columns let the patient be saved regardless, record
 * whether the invite actually went out, and support resending it later.
 */
export class AddInviteEmailStatusToPatients1819000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`patients\`
      ADD COLUMN \`inviteEmailStatus\` VARCHAR(20) NULL,
      ADD COLUMN \`inviteEmailSentAt\` TIMESTAMP NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`patients\`
      DROP COLUMN \`inviteEmailStatus\`,
      DROP COLUMN \`inviteEmailSentAt\`
    `);
  }
}
