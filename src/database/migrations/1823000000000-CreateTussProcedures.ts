import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reference table for the official ANS TUSS procedure codes (Tabela 22 -
 * Procedimentos em Saúde). Populated by the next migration. `code` is the
 * TUSS code itself (no surrogate id needed — it's already unique and stable).
 *
 * IF NOT EXISTS: this table was already created once in production by this
 * exact migration, but the seed migration that follows it failed (see
 * 1824000000000's comment) and rolled back the surrounding transaction —
 * MySQL DDL auto-commits, so the table itself survived that rollback, but
 * whether this migration's own bookkeeping row did is unclear. Making the
 * CREATE idempotent means a retry can't fail with "table already exists".
 */
export class CreateTussProcedures1823000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`tuss_procedures\` (
        \`code\` varchar(20) NOT NULL,
        \`name\` varchar(500) NOT NULL,
        \`validFrom\` date NULL,
        \`validUntil\` date NULL,
        \`implantedThrough\` date NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`tuss_procedures\``);
  }
}
