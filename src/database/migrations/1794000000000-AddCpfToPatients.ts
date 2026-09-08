import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds a `cpf` column to `patients`. Nullable and additive: existing patients
 * keep cpf = NULL and can fill it later in the profile. Doctors already have a
 * `cpf` column, so only `patients` is changed here.
 *
 * Stored as 11 digits (no mask). Not made unique at the DB level because
 * patient email is not unique either (shadow/merge model), so a hard UNIQUE
 * constraint would break shadow duplicates and the merge flow. Duplicate CPF is
 * enforced in application code (ignoring shadow accounts).
 */
export class AddCpfToPatients1794000000000 implements MigrationInterface {
  name = 'AddCpfToPatients1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'patients',
      new TableColumn({
        name: 'cpf',
        type: 'varchar',
        length: '11',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('patients', 'cpf');
  }
}
