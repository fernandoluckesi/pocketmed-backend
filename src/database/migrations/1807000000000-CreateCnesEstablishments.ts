import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Local cache of the government's public CNES establishment data, synced
 * on demand per município the first time a patient searches for a clinic
 * by name in it — see `CnesService`.
 */
export class CreateCnesEstablishments1807000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`cnes_establishments\` (
        \`id\` varchar(36) NOT NULL,
        \`codigoCnes\` varchar(20) NOT NULL,
        \`nomeFantasia\` varchar(255) NOT NULL,
        \`nomeRazaoSocial\` varchar(255) NULL,
        \`cnpj\` varchar(18) NULL,
        \`cep\` varchar(9) NULL,
        \`endereco\` varchar(255) NULL,
        \`numero\` varchar(20) NULL,
        \`bairro\` varchar(100) NULL,
        \`codigoMunicipio\` int NOT NULL,
        \`codigoUf\` int NOT NULL,
        \`telefone\` varchar(30) NULL,
        \`email\` varchar(255) NULL,
        \`latitude\` decimal(10,6) NULL,
        \`longitude\` decimal(10,6) NULL,
        \`syncedAt\` datetime NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_cnes_establishments_codigo_cnes\` (\`codigoCnes\`),
        KEY \`IDX_cnes_establishments_nome_fantasia\` (\`nomeFantasia\`),
        KEY \`IDX_cnes_establishments_codigo_municipio\` (\`codigoMunicipio\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`cnes_establishments\``);
  }
}
