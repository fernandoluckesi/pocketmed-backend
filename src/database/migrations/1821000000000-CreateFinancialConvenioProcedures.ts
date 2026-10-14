import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Each convênio (operadora) pays a different negotiated value for the same
 * procedure. This table lets each clinic keep its own remuneration table per
 * convênio instead of using a single clinic-wide price.
 */
export class CreateFinancialConvenioProcedures1821000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`financial_convenio_procedures\` (
        \`id\` varchar(36) NOT NULL,
        \`clinicId\` varchar(36) NOT NULL,
        \`convenioId\` varchar(36) NOT NULL,
        \`procedureCode\` varchar(20) NOT NULL,
        \`procedureName\` varchar(255) NOT NULL,
        \`value\` decimal(10,2) NOT NULL,
        \`active\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_convenio_procedure_code\` (\`convenioId\`, \`procedureCode\`),
        KEY \`FK_financial_convenio_procedures_convenio\` (\`convenioId\`),
        CONSTRAINT \`FK_financial_convenio_procedures_convenio\` FOREIGN KEY (\`convenioId\`) REFERENCES \`financial_convenios\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`financial_convenio_procedures\``);
  }
}
