import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePatientDiseasesTable1772000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE patient_diseases (
        id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'in_treatment',
        diagnosisDate DATE NULL,
        treatmentStartDate DATE NULL,
        treatmentEndDate DATE NULL,
        patientId VARCHAR(36) NOT NULL,
        doctorId VARCHAR(36) NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY FK_patient_diseases_patient (patientId),
        CONSTRAINT FK_patient_diseases_patient FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE patient_diseases`);
  }
}
