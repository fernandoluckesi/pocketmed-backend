import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the fields needed for patient-filed laudos (medical reports the patient
 * uploads as an external file, read via OCR):
 *  - `extractedText`: the OCR/PDF-extracted plain text shown on screen.
 *  - `createdByPatient`: distinguishes patient-uploaded laudos from
 *    doctor-authored ones (patients may only read/manage the former).
 */
export class AddPatientReportFields1811000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `reports` ADD `extractedText` TEXT NULL;');
    await queryRunner.query(
      'ALTER TABLE `reports` ADD `createdByPatient` tinyint NOT NULL DEFAULT 0;',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `reports` DROP COLUMN `createdByPatient`;');
    await queryRunner.query('ALTER TABLE `reports` DROP COLUMN `extractedText`;');
  }
}
