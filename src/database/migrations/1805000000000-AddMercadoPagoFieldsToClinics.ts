import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the Mercado Pago subscription id to clinics — the active payment
 * gateway for Brazil (PIX/boleto/cartão), alongside the existing (unused)
 * Stripe fields. Reuses `subscriptionStatus`/`currentPeriodEnd` from the
 * Stripe migration since those are gateway-agnostic concepts.
 */
export class AddMercadoPagoFieldsToClinics1805000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clinics
        ADD COLUMN mercadoPagoPreapprovalId VARCHAR(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clinics
        DROP COLUMN mercadoPagoPreapprovalId
    `);
  }
}
