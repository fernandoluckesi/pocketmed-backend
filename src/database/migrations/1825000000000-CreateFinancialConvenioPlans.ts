import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A convênio's own insurance plans (e.g. "Premium", "Básico"), registered per
 * clinic so the Plano field in Receitas can be a select instead of free text.
 */
export class CreateFinancialConvenioPlans1825000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`financial_convenio_plans\` (
        \`id\` varchar(36) NOT NULL,
        \`clinicId\` varchar(36) NOT NULL,
        \`convenioId\` varchar(36) NOT NULL,
        \`name\` varchar(150) NOT NULL,
        \`active\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_convenio_plan_name\` (\`convenioId\`, \`name\`),
        KEY \`FK_financial_convenio_plans_convenio\` (\`convenioId\`),
        CONSTRAINT \`FK_financial_convenio_plans_convenio\` FOREIGN KEY (\`convenioId\`) REFERENCES \`financial_convenios\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`financial_convenio_plans\``);
  }
}
