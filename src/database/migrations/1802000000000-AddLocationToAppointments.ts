import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the consultation's location to appointments: when a clinic creates the
 * appointment, these are snapshotted from the clinic's own address at
 * creation time (so a later change to the clinic's address doesn't rewrite
 * history); otherwise a doctor without an active clinic can fill them in by
 * hand. Additive and non-destructive.
 */
export class AddLocationToAppointments1802000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE appointments
        ADD COLUMN locationClinicName VARCHAR(255) NULL,
        ADD COLUMN locationStreet VARCHAR(255) NULL,
        ADD COLUMN locationNumber VARCHAR(20) NULL,
        ADD COLUMN locationNeighborhood VARCHAR(100) NULL,
        ADD COLUMN locationCity VARCHAR(100) NULL,
        ADD COLUMN locationState VARCHAR(2) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE appointments
        DROP COLUMN locationClinicName,
        DROP COLUMN locationStreet,
        DROP COLUMN locationNumber,
        DROP COLUMN locationNeighborhood,
        DROP COLUMN locationCity,
        DROP COLUMN locationState
    `);
  }
}
