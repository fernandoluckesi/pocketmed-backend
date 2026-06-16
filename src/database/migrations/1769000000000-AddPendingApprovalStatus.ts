import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPendingApprovalStatus1769000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE appointments MODIFY COLUMN status ENUM('pending', 'pending_approval', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'pending'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE appointments MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'pending'`,
    );
  }
}
