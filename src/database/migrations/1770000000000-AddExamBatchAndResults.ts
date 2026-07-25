import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExamBatchAndResults1770000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE exams ADD COLUMN batchId VARCHAR(36) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE exams ADD COLUMN completedAt DATE NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE exams ADD COLUMN resultFiles JSON NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE exams DROP COLUMN resultFiles`);
    await queryRunner.query(`ALTER TABLE exams DROP COLUMN completedAt`);
    await queryRunner.query(`ALTER TABLE exams DROP COLUMN batchId`);
  }
}
