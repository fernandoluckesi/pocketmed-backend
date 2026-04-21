import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRevokedAtToDoctorPermissions1765200000000 implements MigrationInterface {
  name = 'AddRevokedAtToDoctorPermissions1765200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`doctor_permissions\` ADD \`revokedAt\` timestamp NULL DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`doctor_permissions\` DROP COLUMN \`revokedAt\``);
  }
}
