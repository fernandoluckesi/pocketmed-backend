import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSecretariesTable1787500000000 implements MigrationInterface {
  name = 'CreateSecretariesTable1787500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`secretaries\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`password\` varchar(255) NULL,
        \`phone\` varchar(20) NOT NULL,
        \`clinicId\` varchar(36) NOT NULL,
        \`invitedBy\` varchar(36) NULL,
        \`isActive\` tinyint(1) NOT NULL DEFAULT 1,
        \`isShadow\` tinyint(1) NOT NULL DEFAULT 0,
        \`verificationCode\` varchar(6) NULL,
        \`verificationCodeExpiry\` timestamp NULL,
        \`emailVerified\` tinyint(1) NOT NULL DEFAULT 0,
        \`passwordResetCode\` varchar(6) NULL,
        \`passwordResetCodeExpiry\` timestamp NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_secretaries_clinicId\` (\`clinicId\`),
        INDEX \`IDX_secretaries_email\` (\`email\`),
        CONSTRAINT \`FK_secretaries_clinic\` FOREIGN KEY (\`clinicId\`) REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`secretaries\``);
  }
}
