import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds the columns used by the secure email-change flow to both `patients` and
 * `doctors`. All columns are nullable and additive, so existing rows are
 * unaffected. Kept separate from `verificationCode` (which is shared by profile
 * update / account deletion / shadow activation) to avoid cross-flow collisions.
 */
export class AddPendingEmailChange1793000000000 implements MigrationInterface {
  name = 'AddPendingEmailChange1793000000000';

  private columns(): TableColumn[] {
    return [
      new TableColumn({
        name: 'pendingEmail',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'emailChangeCode',
        type: 'varchar',
        length: '6',
        isNullable: true,
      }),
      new TableColumn({
        name: 'emailChangeCodeExpiry',
        type: 'timestamp',
        isNullable: true,
      }),
    ];
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('patients', this.columns());
    await queryRunner.addColumns('doctors', this.columns());
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('doctors', 'emailChangeCodeExpiry');
    await queryRunner.dropColumn('doctors', 'emailChangeCode');
    await queryRunner.dropColumn('doctors', 'pendingEmail');
    await queryRunner.dropColumn('patients', 'emailChangeCodeExpiry');
    await queryRunner.dropColumn('patients', 'emailChangeCode');
    await queryRunner.dropColumn('patients', 'pendingEmail');
  }
}
