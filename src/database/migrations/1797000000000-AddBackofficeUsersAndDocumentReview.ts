import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBackofficeUsersAndDocumentReview1797000000000 implements MigrationInterface {
  name = 'AddBackofficeUsersAndDocumentReview1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Internal Hispora staff accounts (platform-wide, not clinic scoped).
    await queryRunner.query(`
      CREATE TABLE \`backoffice_users\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`password\` varchar(255) NOT NULL,
        \`backofficeRole\` enum('superadmin','analyst','auditor') NOT NULL DEFAULT 'analyst',
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`lastLoginAt\` timestamp NULL,
        \`passwordResetCode\` varchar(6) NULL,
        \`passwordResetCodeExpiry\` timestamp NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_backoffice_users_email\` (\`email\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Track WHO reviewed each document (the approval trail lives in audit_events,
    // this column keeps the current reviewer denormalized for listing screens).
    await queryRunner.query(
      `ALTER TABLE \`doctor_documents\` ADD COLUMN \`reviewedBy\` varchar(36) NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`doctor_documents\` DROP COLUMN \`reviewedBy\`;`);
    await queryRunner.query(`DROP TABLE \`backoffice_users\`;`);
  }
}
