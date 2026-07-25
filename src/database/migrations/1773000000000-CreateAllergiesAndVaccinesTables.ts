import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAllergiesAndVaccinesTables1773000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE patient_allergies (
        id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'moderate',
        reaction TEXT NULL,
        notes TEXT NULL,
        patientId VARCHAR(36) NOT NULL,
        doctorId VARCHAR(36) NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY FK_patient_allergies_patient (patientId),
        CONSTRAINT FK_patient_allergies_patient FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE patient_vaccines (
        id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        dose VARCHAR(50) NULL,
        applicationDate DATE NULL,
        nextDoseDate DATE NULL,
        laboratory VARCHAR(255) NULL,
        notes TEXT NULL,
        patientId VARCHAR(36) NOT NULL,
        doctorId VARCHAR(36) NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY FK_patient_vaccines_patient (patientId),
        CONSTRAINT FK_patient_vaccines_patient FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE patient_vaccines`);
    await queryRunner.query(`DROP TABLE patient_allergies`);
  }
}
