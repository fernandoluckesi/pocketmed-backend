import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDoctorLockToAppointments1769100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE appointments ADD COLUMN lastModifiedById VARCHAR(36) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE appointments ADD COLUMN lastModifiedByType VARCHAR(10) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE appointments ADD COLUMN lockedByDoctor TINYINT(1) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE appointments DROP COLUMN lockedByDoctor`);
    await queryRunner.query(`ALTER TABLE appointments DROP COLUMN lastModifiedByType`);
    await queryRunner.query(`ALTER TABLE appointments DROP COLUMN lastModifiedById`);
  }
}
