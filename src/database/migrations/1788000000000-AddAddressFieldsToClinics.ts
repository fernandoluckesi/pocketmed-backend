import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAddressFieldsToClinics1788000000000 implements MigrationInterface {
  name = 'AddAddressFieldsToClinics1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `clinics` ADD COLUMN `cep` varchar(9) NULL;');
    await queryRunner.query('ALTER TABLE `clinics` ADD COLUMN `street` varchar(255) NULL;');
    await queryRunner.query('ALTER TABLE `clinics` ADD COLUMN `number` varchar(20) NULL;');
    await queryRunner.query('ALTER TABLE `clinics` ADD COLUMN `complement` varchar(255) NULL;');
    await queryRunner.query('ALTER TABLE `clinics` ADD COLUMN `neighborhood` varchar(100) NULL;');
    await queryRunner.query('ALTER TABLE `clinics` ADD COLUMN `city` varchar(100) NULL;');
    await queryRunner.query('ALTER TABLE `clinics` ADD COLUMN `state` varchar(2) NULL;');
    await queryRunner.query(
      'ALTER TABLE `clinics` ADD COLUMN `noNumber` tinyint NOT NULL DEFAULT 0;',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `clinics` DROP COLUMN `noNumber`;');
    await queryRunner.query('ALTER TABLE `clinics` DROP COLUMN `state`;');
    await queryRunner.query('ALTER TABLE `clinics` DROP COLUMN `city`;');
    await queryRunner.query('ALTER TABLE `clinics` DROP COLUMN `neighborhood`;');
    await queryRunner.query('ALTER TABLE `clinics` DROP COLUMN `complement`;');
    await queryRunner.query('ALTER TABLE `clinics` DROP COLUMN `number`;');
    await queryRunner.query('ALTER TABLE `clinics` DROP COLUMN `street`;');
    await queryRunner.query('ALTER TABLE `clinics` DROP COLUMN `cep`;');
  }
}
