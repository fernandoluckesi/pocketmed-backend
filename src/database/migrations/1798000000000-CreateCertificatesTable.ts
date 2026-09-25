import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the certificates table ("atestados"): a medical leave certificate
 * issued by a doctor for a patient/dependent, optionally tied to an
 * appointment. Simpler than doctor_documents — no review status. Additive and
 * non-destructive. FK to patients/dependents with ON DELETE CASCADE, matching
 * patient_diseases/allergies/vaccines/surgeries.
 */
export class CreateCertificatesTable1798000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE certificates (
        id VARCHAR(36) NOT NULL,
        doctorId VARCHAR(36) NULL,
        patientId VARCHAR(36) NULL,
        dependentId VARCHAR(36) NULL,
        appointmentId VARCHAR(36) NULL,
        crm VARCHAR(20) NOT NULL,
        cid VARCHAR(20) NULL,
        description TEXT NULL,
        daysOff INT NULL,
        issueDate DATE NULL,
        fileUrl VARCHAR(500) NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY FK_certificates_patient (patientId),
        KEY FK_certificates_dependent (dependentId),
        CONSTRAINT FK_certificates_patient FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE,
        CONSTRAINT FK_certificates_dependent FOREIGN KEY (dependentId) REFERENCES dependents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE certificates`);
  }
}
