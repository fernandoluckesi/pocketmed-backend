import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Consultation timer for clinic-side reporting (revenue vs. time spent):
 * when the doctor started and ended the consultation, plus the resulting
 * duration in seconds. Additive and non-destructive; all nullable since
 * existing appointments never had a timer running.
 */
export class AddConsultationTimerToAppointments1809000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE appointments
        ADD COLUMN startedAt TIMESTAMP NULL,
        ADD COLUMN endedAt TIMESTAMP NULL,
        ADD COLUMN durationSeconds INT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE appointments
        DROP COLUMN durationSeconds,
        DROP COLUMN endedAt,
        DROP COLUMN startedAt
    `);
  }
}
