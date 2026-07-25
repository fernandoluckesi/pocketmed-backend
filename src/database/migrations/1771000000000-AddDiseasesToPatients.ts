import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDiseasesToPatients1771000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE patients ADD COLUMN diseases JSON NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE patients DROP COLUMN diseases`);
  }
}
