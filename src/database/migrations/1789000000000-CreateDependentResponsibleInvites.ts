import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateDependentResponsibleInvites1789000000000 implements MigrationInterface {
  name = 'CreateDependentResponsibleInvites1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'dependent_responsible_invites',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'dependentId', type: 'varchar', length: '36', isNullable: false },
          { name: 'inviterPatientId', type: 'varchar', length: '36', isNullable: false },
          { name: 'inviteePatientId', type: 'varchar', length: '36', isNullable: false },
          { name: 'inviteeEmail', type: 'varchar', length: '255', isNullable: false },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'accepted', 'rejected'],
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
            name: 'IDX_dep_resp_invite_invitee_status',
            columnNames: ['inviteePatientId', 'status'],
          },
          {
            name: 'IDX_dep_resp_invite_dependent',
            columnNames: ['dependentId'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'dependent_responsible_invites',
      new TableForeignKey({
        columnNames: ['dependentId'],
        referencedTableName: 'dependents',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'dependent_responsible_invites',
      new TableForeignKey({
        columnNames: ['inviterPatientId'],
        referencedTableName: 'patients',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'dependent_responsible_invites',
      new TableForeignKey({
        columnNames: ['inviteePatientId'],
        referencedTableName: 'patients',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('dependent_responsible_invites');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('dependent_responsible_invites', fk);
      }
    }
    await queryRunner.dropTable('dependent_responsible_invites');
  }
}
