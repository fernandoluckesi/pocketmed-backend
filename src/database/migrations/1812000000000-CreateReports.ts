import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Medical reports ("laudos") — richer, free-form documents (9 independently
 * optional rich-text clinical fields) sharing the same document/signature
 * lifecycle columns as `prescriptions`. Doctor/patient identification is
 * snapshotted at creation time (`*Snapshot` columns) so a later profile edit
 * never rewrites an already-issued document. `supersedesReportId` is a
 * nullable self-reference reserved for future versioning — always NULL today.
 */
export class CreateReports1812000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`reports\` (
        \`id\` varchar(36) NOT NULL,
        \`doctorId\` varchar(36) NOT NULL,
        \`patientId\` varchar(36) NULL,
        \`dependentId\` varchar(36) NULL,
        \`appointmentId\` varchar(36) NULL,
        \`reportType\` enum('laudo_medico','laudo_exame','relatorio_medico','relatorio_acompanhamento','laudo_administrativo','laudo_trabalhista','laudo_previdenciario','outro') NOT NULL,
        \`reportTypeOther\` varchar(255) NULL,
        \`issueDate\` date NOT NULL,
        \`relatedServiceDate\` date NULL,
        \`purpose\` varchar(255) NULL,
        \`title\` varchar(255) NOT NULL,
        \`doctorNameSnapshot\` varchar(255) NOT NULL,
        \`doctorCrmSnapshot\` varchar(20) NOT NULL,
        \`doctorSpecialtySnapshot\` varchar(100) NULL,
        \`patientNameSnapshot\` varchar(255) NOT NULL,
        \`patientCpfSnapshot\` varchar(14) NULL,
        \`patientBirthDateSnapshot\` date NULL,
        \`patientGenderSnapshot\` varchar(50) NULL,
        \`chiefComplaint\` json NULL,
        \`clinicalHistory\` json NULL,
        \`physicalExam\` json NULL,
        \`complementaryExams\` json NULL,
        \`results\` json NULL,
        \`diagnosis\` json NULL,
        \`conclusion\` json NULL,
        \`recommendations\` json NULL,
        \`observations\` json NULL,
        \`status\` enum('draft','generated','signed','canceled') NOT NULL DEFAULT 'draft',
        \`documentUrl\` varchar(500) NULL,
        \`fileUrl\` varchar(500) NULL,
        \`documentHash\` varchar(64) NULL,
        \`documentType\` varchar(50) NOT NULL DEFAULT 'report',
        \`signatureStatus\` enum('none','pending','signed','failed','rejected') NOT NULL DEFAULT 'none',
        \`signatureProvider\` varchar(50) NULL,
        \`signedAt\` timestamp NULL,
        \`externalSignatureId\` varchar(255) NULL,
        \`supersedesReportId\` varchar(36) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`FK_reports_doctor\` (\`doctorId\`),
        KEY \`FK_reports_patient\` (\`patientId\`),
        KEY \`FK_reports_dependent\` (\`dependentId\`),
        KEY \`FK_reports_appointment\` (\`appointmentId\`),
        KEY \`FK_reports_supersedes\` (\`supersedesReportId\`),
        CONSTRAINT \`FK_reports_doctor\` FOREIGN KEY (\`doctorId\`) REFERENCES \`doctors\`(\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`FK_reports_patient\` FOREIGN KEY (\`patientId\`) REFERENCES \`patients\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_reports_dependent\` FOREIGN KEY (\`dependentId\`) REFERENCES \`dependents\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_reports_appointment\` FOREIGN KEY (\`appointmentId\`) REFERENCES \`appointments\`(\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`FK_reports_supersedes\` FOREIGN KEY (\`supersedesReportId\`) REFERENCES \`reports\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `reports`');
  }
}
