import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomExamNameToScheduleItems1766100000000 implements MigrationInterface {
  name = 'AddCustomExamNameToScheduleItems1766100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make examCatalogId nullable (to support custom exams without a catalog entry)
    await queryRunner.query(
      'ALTER TABLE `exam_schedule_items` DROP FOREIGN KEY `FK_exam_schedule_items_catalog`;',
    );
    await queryRunner.query(
      'ALTER TABLE `exam_schedule_items` MODIFY COLUMN `examCatalogId` varchar(36) NULL;',
    );
    await queryRunner.query(
      'ALTER TABLE `exam_schedule_items` ADD CONSTRAINT `FK_exam_schedule_items_catalog` FOREIGN KEY (`examCatalogId`) REFERENCES `exam_catalog`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;',
    );

    // Add customExamName column for manually entered exams
    await queryRunner.query(
      'ALTER TABLE `exam_schedule_items` ADD COLUMN `customExamName` varchar(255) NULL;',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `exam_schedule_items` DROP COLUMN `customExamName`;');
    await queryRunner.query(
      'ALTER TABLE `exam_schedule_items` DROP FOREIGN KEY `FK_exam_schedule_items_catalog`;',
    );
    await queryRunner.query(
      'ALTER TABLE `exam_schedule_items` MODIFY COLUMN `examCatalogId` varchar(36) NOT NULL;',
    );
    await queryRunner.query(
      'ALTER TABLE `exam_schedule_items` ADD CONSTRAINT `FK_exam_schedule_items_catalog` FOREIGN KEY (`examCatalogId`) REFERENCES `exam_catalog`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;',
    );
  }
}
