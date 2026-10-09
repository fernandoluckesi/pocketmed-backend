import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `financial_expenses.costCenterId` was NOT NULL, but the quick "Lançar
 * Despesa" form (and the rest of the financial module's reports, which
 * already group unassigned expenses under "Sem centro") never required a
 * cost center — every POST /financial/expenses through that form 500'd on
 * insert because costCenterId came through as NULL. Makes the column
 * nullable to match how it's actually used.
 */
export class MakeExpenseCostCenterNullable1818000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`financial_expenses\`
      MODIFY COLUMN \`costCenterId\` VARCHAR(36) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`financial_expenses\`
      MODIFY COLUMN \`costCenterId\` VARCHAR(36) NOT NULL
    `);
  }
}
