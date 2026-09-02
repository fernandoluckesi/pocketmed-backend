import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddResultToExamSchedules1791000000000 implements MigrationInterface {
  name = 'AddResultToExamSchedules1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('exam_schedules', [
      new TableColumn({
        name: 'resultText',
        type: 'text',
        isNullable: true,
      }),
      new TableColumn({
        name: 'resultFileUrl',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('exam_schedules', 'resultFileUrl');
    await queryRunner.dropColumn('exam_schedules', 'resultText');
  }
}
