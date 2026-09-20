import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the medication_catalog table, populated from the official ANVISA/CMED
 * medication price list (see seed:medications). Additive and non-destructive.
 */
export class CreateMedicationCatalogTable1800000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`medication_catalog\` (
        \`id\` varchar(36) NOT NULL,
        \`substance\` varchar(255) NOT NULL,
        \`product\` varchar(255) NOT NULL,
        \`presentation\` varchar(500) NULL,
        \`manufacturer\` varchar(255) NULL,
        \`registrationNumber\` varchar(30) NULL,
        \`therapeuticClass\` varchar(255) NULL,
        \`productType\` varchar(50) NULL,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_medication_catalog_substance\` (\`substance\`),
        KEY \`IDX_medication_catalog_product\` (\`product\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `medication_catalog`;');
  }
}
