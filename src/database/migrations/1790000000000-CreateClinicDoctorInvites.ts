import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateClinicDoctorInvites1790000000000 implements MigrationInterface {
  name = 'CreateClinicDoctorInvites1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'clinic_doctor_invites',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'clinicId', type: 'varchar', length: '36', isNullable: false },
          { name: 'doctorId', type: 'varchar', length: '36', isNullable: false },
          { name: 'invitedBy', type: 'varchar', length: '36', isNullable: false },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'approved', 'rejected', 'cancelled', 'expired'],
            default: "'pending'",
          },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          {
            name: 'IDX_invite_clinic_doctor_status',
            columnNames: ['clinicId', 'doctorId', 'status'],
          },
          {
            name: 'IDX_invite_doctor',
            columnNames: ['doctorId'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'clinic_doctor_invites',
      new TableForeignKey({
        columnNames: ['clinicId'],
        referencedTableName: 'clinics',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'clinic_doctor_invites',
      new TableForeignKey({
        columnNames: ['doctorId'],
        referencedTableName: 'doctors',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'clinic_doctor_invites',
      new TableForeignKey({
        columnNames: ['invitedBy'],
        referencedTableName: 'doctors',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('clinic_doctor_invites');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('clinic_doctor_invites', fk);
      }
    }
    await queryRunner.dropTable('clinic_doctor_invites');
  }
}
