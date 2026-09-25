import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the Stripe billing fields to clinics: customer/subscription ids and
 * the mirrored subscription status/period-end, so a clinic's plan can be
 * driven by real payment gateway events (checkout, portal, webhooks)
 * instead of only the manual/free admin-set path. All nullable — a clinic
 * with no Stripe fields is simply not billed through the gateway yet.
 */
export class AddStripeFieldsToClinics1804000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clinics
        ADD COLUMN stripeCustomerId VARCHAR(255) NULL,
        ADD COLUMN stripeSubscriptionId VARCHAR(255) NULL,
        ADD COLUMN subscriptionStatus VARCHAR(30) NULL,
        ADD COLUMN currentPeriodEnd DATETIME NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clinics
        DROP COLUMN stripeCustomerId,
        DROP COLUMN stripeSubscriptionId,
        DROP COLUMN subscriptionStatus,
        DROP COLUMN currentPeriodEnd
    `);
  }
}
