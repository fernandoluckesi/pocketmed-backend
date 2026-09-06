import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDependentToExamSchedules1792000000000 implements MigrationInterface {
  name = 'AddDependentToExamSchedules1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nullable column: existing schedules keep dependentId = NULL (they belong
    // to the responsible patient). New schedules may target a dependent.
    await queryRunner.addColumn(
      'exam_schedules',
      new TableColumn({
        name: 'dependentId',
        type: 'char',
        length: '36',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('exam_schedules', 'dependentId');
  }
}
