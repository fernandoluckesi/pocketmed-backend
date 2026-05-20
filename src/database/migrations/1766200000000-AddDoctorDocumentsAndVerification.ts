import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDoctorDocumentsAndVerification1766200000000 implements MigrationInterface {
  name = 'AddDoctorDocumentsAndVerification1766200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add verificationStatus column to doctors table
    await queryRunner.query(
      `ALTER TABLE \`doctors\` ADD COLUMN \`verificationStatus\` varchar(20) NOT NULL DEFAULT 'PENDING';`,
    );

    // Create doctor_documents table
    await queryRunner.query(`
      CREATE TABLE \`doctor_documents\` (
        \`id\` varchar(36) NOT NULL,
        \`doctorId\` varchar(36) NOT NULL,
        \`type\` varchar(50) NOT NULL,
        \`fileUrl\` varchar(500) NOT NULL,
        \`originalFileName\` varchar(255) NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'PENDING',
        \`rejectionReason\` text NULL,
        \`reviewedAt\` timestamp NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`FK_doctor_documents_doctor\` (\`doctorId\`),
        CONSTRAINT \`FK_doctor_documents_doctor\` FOREIGN KEY (\`doctorId\`) REFERENCES \`doctors\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`doctor_documents\`;`);
    await queryRunner.query(
      `ALTER TABLE \`doctors\` DROP COLUMN \`verificationStatus\`;`,
    );
  }
}
