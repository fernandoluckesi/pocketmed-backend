import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAppointmentIdToExamSchedules1797000000000
  implements MigrationInterface
{
  name = 'AddAppointmentIdToExamSchedules1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Link an exam schedule to the consultation it was created from.
    await queryRunner.addColumn(
      'exam_schedules',
      new TableColumn({
        name: 'appointmentId',
        type: 'varchar',
        length: '36',
        isNullable: true,
      }),
    );

    // An exam prescribed during a consultation may not have a date/time yet,
    // so scheduledDateTime becomes nullable.
    await queryRunner.changeColumn(
      'exam_schedules',
      'scheduledDateTime',
      new TableColumn({
        name: 'scheduledDateTime',
        type: 'timestamp',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert nullability. Rows with NULL would break a NOT NULL constraint, so
    // backfill them with the creation date before restoring the constraint.
    await queryRunner.query(
      `UPDATE exam_schedules SET scheduledDateTime = createdAt WHERE scheduledDateTime IS NULL`,
    );
    await queryRunner.changeColumn(
      'exam_schedules',
      'scheduledDateTime',
      new TableColumn({
        name: 'scheduledDateTime',
        type: 'timestamp',
        isNullable: false,
      }),
    );

    await queryRunner.dropColumn('exam_schedules', 'appointmentId');
  }
}
