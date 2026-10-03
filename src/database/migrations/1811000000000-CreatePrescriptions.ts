import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Formal prescription documents ("receitas") — a doctor-authored, printable
 * bundle of medications, distinct from the per-drug `medications` table.
 * Prepared for a future digital signature (ICP-Brasil): the signature/document
 * columns exist now but are only ever populated by the current mock provider,
 * which never produces `signatureStatus = 'signed'`. No certificate, password,
 * or private key is ever stored here.
 */
export class CreatePrescriptions1811000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`prescriptions\` (
        \`id\` varchar(36) NOT NULL,
        \`doctorId\` varchar(36) NOT NULL,
        \`patientId\` varchar(36) NULL,
        \`dependentId\` varchar(36) NULL,
        \`appointmentId\` varchar(36) NULL,
        \`issueDate\` date NOT NULL,
        \`items\` json NOT NULL,
        \`observations\` text NULL,
        \`status\` enum('draft','generated','signed','canceled') NOT NULL DEFAULT 'draft',
        \`documentUrl\` varchar(500) NULL,
        \`documentHash\` varchar(64) NULL,
        \`documentType\` varchar(50) NOT NULL DEFAULT 'prescription',
        \`signatureStatus\` enum('none','pending','signed','failed','rejected') NOT NULL DEFAULT 'none',
        \`signatureProvider\` varchar(50) NULL,
        \`signedAt\` timestamp NULL,
        \`externalSignatureId\` varchar(255) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`FK_prescriptions_doctor\` (\`doctorId\`),
        KEY \`FK_prescriptions_patient\` (\`patientId\`),
        KEY \`FK_prescriptions_dependent\` (\`dependentId\`),
        KEY \`FK_prescriptions_appointment\` (\`appointmentId\`),
        CONSTRAINT \`FK_prescriptions_doctor\` FOREIGN KEY (\`doctorId\`) REFERENCES \`doctors\`(\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`FK_prescriptions_patient\` FOREIGN KEY (\`patientId\`) REFERENCES \`patients\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_prescriptions_dependent\` FOREIGN KEY (\`dependentId\`) REFERENCES \`dependents\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_prescriptions_appointment\` FOREIGN KEY (\`appointmentId\`) REFERENCES \`appointments\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `prescriptions`');
  }
}
