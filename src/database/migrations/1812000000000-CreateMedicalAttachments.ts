import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Patient-uploaded shared attachments (a "receita" shared by many medications,
 * a "guia" shared by many exams), with the OCR/extracted text, plus the
 * nullable FK columns on medications and exams that reference them.
 */
export class CreateMedicalAttachments1812000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`medical_attachments\` (
        \`id\` varchar(36) NOT NULL,
        \`kind\` enum('receita','guia') NOT NULL,
        \`fileUrl\` varchar(500) NOT NULL,
        \`extractedText\` text NULL,
        \`patientId\` varchar(36) NULL,
        \`dependentId\` varchar(36) NULL,
        \`appointmentId\` varchar(36) NULL,
        \`createdByPatient\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(
      'ALTER TABLE `medications` ADD `attachmentId` varchar(36) NULL;',
    );
    await queryRunner.query('ALTER TABLE `exams` ADD `attachmentId` varchar(36) NULL;');

    await queryRunner.query(`
      ALTER TABLE \`medical_attachments\`
        ADD CONSTRAINT \`FK_medatt_patient\` FOREIGN KEY (\`patientId\`)
        REFERENCES \`patients\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE \`medical_attachments\`
        ADD CONSTRAINT \`FK_medatt_dependent\` FOREIGN KEY (\`dependentId\`)
        REFERENCES \`dependents\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE \`medical_attachments\`
        ADD CONSTRAINT \`FK_medatt_appointment\` FOREIGN KEY (\`appointmentId\`)
        REFERENCES \`appointments\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE \`medications\`
        ADD CONSTRAINT \`FK_medications_attachment\` FOREIGN KEY (\`attachmentId\`)
        REFERENCES \`medical_attachments\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE \`exams\`
        ADD CONSTRAINT \`FK_exams_attachment\` FOREIGN KEY (\`attachmentId\`)
        REFERENCES \`medical_attachments\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `exams` DROP FOREIGN KEY `FK_exams_attachment`;');
    await queryRunner.query(
      'ALTER TABLE `medications` DROP FOREIGN KEY `FK_medications_attachment`;',
    );
    await queryRunner.query(
      'ALTER TABLE `medical_attachments` DROP FOREIGN KEY `FK_medatt_appointment`;',
    );
    await queryRunner.query(
      'ALTER TABLE `medical_attachments` DROP FOREIGN KEY `FK_medatt_dependent`;',
    );
    await queryRunner.query(
      'ALTER TABLE `medical_attachments` DROP FOREIGN KEY `FK_medatt_patient`;',
    );
    await queryRunner.query('ALTER TABLE `exams` DROP COLUMN `attachmentId`;');
    await queryRunner.query('ALTER TABLE `medications` DROP COLUMN `attachmentId`;');
    await queryRunner.query('DROP TABLE `medical_attachments`;');
  }
}
