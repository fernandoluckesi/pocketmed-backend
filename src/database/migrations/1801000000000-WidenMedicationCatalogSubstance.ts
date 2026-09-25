import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Widens medication_catalog.substance from VARCHAR(255) to TEXT: multivalent
 * vaccine associations (e.g. pneumococcal) list dozens of serotypes and exceed
 * 1400 characters, which failed the ANVISA import (ER_DATA_TOO_LONG).
 * TEXT columns can't be indexed without a key length, so the index is
 * recreated with a 191-char prefix (matches utf8mb4's 767-byte key limit).
 */
export class WidenMedicationCatalogSubstance1801000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `medication_catalog` DROP INDEX `IDX_medication_catalog_substance`;',
    );
    await queryRunner.query('ALTER TABLE `medication_catalog` MODIFY `substance` TEXT NOT NULL;');
    await queryRunner.query(
      'ALTER TABLE `medication_catalog` ADD INDEX `IDX_medication_catalog_substance` (`substance`(191));',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `medication_catalog` DROP INDEX `IDX_medication_catalog_substance`;',
    );
    await queryRunner.query(
      'ALTER TABLE `medication_catalog` MODIFY `substance` VARCHAR(255) NOT NULL;',
    );
    await queryRunner.query(
      'ALTER TABLE `medication_catalog` ADD INDEX `IDX_medication_catalog_substance` (`substance`);',
    );
  }
}
