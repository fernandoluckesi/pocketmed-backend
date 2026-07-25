import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLockedByDoctorToMedicationsAndExams1769200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE medications ADD COLUMN lockedByDoctor TINYINT(1) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE exams ADD COLUMN lockedByDoctor TINYINT(1) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE exams DROP COLUMN lockedByDoctor`);
    await queryRunner.query(`ALTER TABLE medications DROP COLUMN lockedByDoctor`);
  }
}
