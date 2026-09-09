import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes medications.doctorId nullable.
 *
 * A patient can register a medication tied to a consultation performed by an
 * external (non-registered) doctor. Those appointments have doctorId = NULL,
 * so the medication inherits a NULL doctorId — which previously violated the
 * NOT NULL constraint and produced a 500. This relaxes the column to allow it.
 *
 * MySQL requires dropping the FK before modifying the column, then re-adding it.
 * Guarded so it is safe to run once on environments that already have the FK.
 */
export class MakeMedicationDoctorNullable1796000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const fk = await queryRunner.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'medications'
         AND COLUMN_NAME = 'doctorId'
         AND REFERENCED_TABLE_NAME = 'doctors'
       LIMIT 1;`,
    );
    const fkName: string | undefined = fk?.[0]?.CONSTRAINT_NAME;

    if (fkName) {
      await queryRunner.query(`ALTER TABLE \`medications\` DROP FOREIGN KEY \`${fkName}\`;`);
    }

    await queryRunner.query(
      'ALTER TABLE `medications` MODIFY `doctorId` varchar(36) NULL;',
    );

    // Re-create the FK (nullable columns are allowed to reference; NULL skips it).
    await queryRunner.query(
      'ALTER TABLE `medications` ADD CONSTRAINT `FK_medications_doctor` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to NOT NULL. This will fail if any medication has a NULL doctorId,
    // which is expected — the down migration assumes clean data.
    const fk = await queryRunner.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'medications'
         AND COLUMN_NAME = 'doctorId'
         AND REFERENCED_TABLE_NAME = 'doctors'
       LIMIT 1;`,
    );
    const fkName: string | undefined = fk?.[0]?.CONSTRAINT_NAME;

    if (fkName) {
      await queryRunner.query(`ALTER TABLE \`medications\` DROP FOREIGN KEY \`${fkName}\`;`);
    }

    await queryRunner.query(
      'ALTER TABLE `medications` MODIFY `doctorId` varchar(36) NOT NULL;',
    );

    await queryRunner.query(
      'ALTER TABLE `medications` ADD CONSTRAINT `FK_medications_doctor` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;',
    );
  }
}
