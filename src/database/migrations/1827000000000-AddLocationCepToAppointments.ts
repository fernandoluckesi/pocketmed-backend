import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the postal code (CEP) to the appointment's snapshotted location.
 *
 * The other location columns were added in 1802; the CEP was collected on the
 * mobile form (and used to auto-fill the address) but never persisted, so it
 * came back empty when editing an appointment. This stores it alongside the
 * rest of the address. Additive and non-destructive.
 */
export class AddLocationCepToAppointments1827000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE appointments
        ADD COLUMN locationCep VARCHAR(9) NULL AFTER locationClinicName
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE appointments
        DROP COLUMN locationCep
    `);
  }
}
