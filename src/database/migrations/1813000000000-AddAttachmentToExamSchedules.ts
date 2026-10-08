import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Links an exam schedule to a patient-uploaded "guia" (exam order) file: one
 * guia shared by all the exam items in the schedule. Nullable FK to
 * medical_attachments.
 */
export class AddAttachmentToExamSchedules1813000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `exam_schedules` ADD `attachmentId` varchar(36) NULL;',
    );
    await queryRunner.query(`
      ALTER TABLE \`exam_schedules\`
        ADD CONSTRAINT \`FK_exam_schedules_attachment\` FOREIGN KEY (\`attachmentId\`)
        REFERENCES \`medical_attachments\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `exam_schedules` DROP FOREIGN KEY `FK_exam_schedules_attachment`;',
    );
    await queryRunner.query('ALTER TABLE `exam_schedules` DROP COLUMN `attachmentId`;');
  }
}
