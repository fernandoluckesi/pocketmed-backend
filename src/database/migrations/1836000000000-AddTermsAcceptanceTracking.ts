import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records WHEN and WHICH VERSION of the Terms/Privacy Policy each user
 * accepted (audit finding, item 5 of the legal audit).
 *
 * Before this, the acceptance existed only as a required checkbox in the web
 * form — nothing was persisted. In a dispute, "the checkbox was mandatory"
 * is a much weaker argument than a timestamped record naming the exact
 * document version, especially for health data, where LGPD art. 11 requires
 * consent to be given "de forma específica e destacada".
 *
 * Nullable on purpose: existing users accepted an earlier version that was
 * never recorded, and back-filling a date we don't actually know would be
 * inventing evidence. NULL means "accepted before we started tracking",
 * which is the honest state.
 */
export class AddTermsAcceptanceTracking1836000000000 implements MigrationInterface {
  name = 'AddTermsAcceptanceTracking1836000000000';

  private async columnExists(qr: QueryRunner, table: string, column: string): Promise<boolean> {
    const rows = await qr.query(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [table, column],
    );
    return Number(rows[0].c) > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['patients', 'doctors']) {
      if (!(await this.columnExists(queryRunner, table, 'termsAcceptedAt'))) {
        await queryRunner.query(
          `ALTER TABLE \`${table}\` ADD COLUMN \`termsAcceptedAt\` datetime NULL`,
        );
      }
      // Version string rather than a FK to a documents table: the policy
      // lives in the frontend bundle, not in the DB, so a date-based version
      // ("2026-10") is what actually identifies the text that was shown.
      if (!(await this.columnExists(queryRunner, table, 'termsAcceptedVersion'))) {
        await queryRunner.query(
          `ALTER TABLE \`${table}\` ADD COLUMN \`termsAcceptedVersion\` varchar(20) NULL`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['patients', 'doctors']) {
      for (const column of ['termsAcceptedVersion', 'termsAcceptedAt']) {
        if (await this.columnExists(queryRunner, table, column)) {
          await queryRunner.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
        }
      }
    }
  }
}
