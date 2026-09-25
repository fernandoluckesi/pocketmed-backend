import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hispora's own record of subscription revenue (money clinics pay Hispora
 * for their plan), one row per gateway charge — distinct from
 * `financial_revenues`, which is a clinic's own patient billing.
 *
 * Also adds `mercadoPagoExternalReference` to clinics: the reconciliation
 * cron needs it to search Mercado Pago for payments belonging to a given
 * clinic's active subscription (search is by external_reference, not by
 * preapproval id).
 */
export class CreateSubscriptionPayments1806000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`subscription_payments\` (
        \`id\` varchar(36) NOT NULL,
        \`clinicId\` varchar(36) NOT NULL,
        \`provider\` varchar(20) NOT NULL,
        \`externalPaymentId\` varchar(50) NOT NULL,
        \`preapprovalId\` varchar(255) NULL,
        \`status\` varchar(20) NOT NULL,
        \`statusDetail\` varchar(100) NULL,
        \`transactionAmount\` decimal(10,2) NOT NULL,
        \`netReceivedAmount\` decimal(10,2) NULL,
        \`feeAmount\` decimal(10,2) NULL,
        \`currencyId\` varchar(10) NULL,
        \`paymentMethodId\` varchar(50) NULL,
        \`paymentTypeId\` varchar(50) NULL,
        \`description\` varchar(255) NULL,
        \`dateCreated\` datetime NULL,
        \`dateApproved\` datetime NULL,
        \`moneyReleaseDate\` datetime NULL,
        \`moneyReleaseStatus\` varchar(20) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_subscription_payments_provider_external\` (\`provider\`, \`externalPaymentId\`),
        KEY \`FK_subscription_payments_clinic\` (\`clinicId\`),
        CONSTRAINT \`FK_subscription_payments_clinic\` FOREIGN KEY (\`clinicId\`) REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      ALTER TABLE clinics
        ADD COLUMN mercadoPagoExternalReference VARCHAR(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE clinics DROP COLUMN mercadoPagoExternalReference`);
    await queryRunner.query(`DROP TABLE \`subscription_payments\``);
  }
}
