import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds visit type ("consulta"/"retorno") and payment type ("particular"/
 * "convenio") to appointments, plus an optional FK to the clinic's
 * financial_convenios when paymentType is "convenio". Additive and
 * non-destructive; defaults preserve current behavior for existing rows.
 */
export class AddVisitAndPaymentTypeToAppointments1799000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE appointments
        ADD COLUMN visitType VARCHAR(20) NOT NULL DEFAULT 'consulta',
        ADD COLUMN paymentType VARCHAR(20) NOT NULL DEFAULT 'particular',
        ADD COLUMN convenioId VARCHAR(36) NULL,
        ADD KEY FK_appointments_convenio (convenioId),
        ADD CONSTRAINT FK_appointments_convenio FOREIGN KEY (convenioId)
          REFERENCES financial_convenios(id) ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE appointments
        DROP FOREIGN KEY FK_appointments_convenio,
        DROP COLUMN convenioId,
        DROP COLUMN paymentType,
        DROP COLUMN visitType
    `);
  }
}
