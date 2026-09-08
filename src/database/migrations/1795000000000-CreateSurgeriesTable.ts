import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the patient_surgeries table (patient surgical history). Additive and
 * non-destructive: no existing table/data is touched. FK to patients with
 * ON DELETE CASCADE, matching patient_diseases/allergies/vaccines.
 */
export class CreateSurgeriesTable1795000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE patient_surgeries (
        id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
        date DATE NULL,
        indication TEXT NULL,
        diagnosisId VARCHAR(36) NULL,
        bodyRegion VARCHAR(255) NULL,
        laterality VARCHAR(20) NULL,
        hospitalOrClinic VARCHAR(255) NULL,
        surgeonName VARCHAR(255) NULL,
        surgeonSpecialty VARCHAR(255) NULL,
        city VARCHAR(255) NULL,
        state VARCHAR(50) NULL,
        surgeryType VARCHAR(20) NULL,
        technique VARCHAR(20) NULL,
        anesthesia VARCHAR(20) NULL,
        outcome TEXT NULL,
        hadComplications TINYINT NOT NULL DEFAULT 0,
        complications TEXT NULL,
        hospitalAdmission TINYINT NOT NULL DEFAULT 0,
        dischargeDate DATE NULL,
        postoperativeNotes TEXT NULL,
        hasPermanentImplant TINYINT NOT NULL DEFAULT 0,
        implantType VARCHAR(255) NULL,
        implantDescription TEXT NULL,
        implantManufacturer VARCHAR(255) NULL,
        implantModel VARCHAR(255) NULL,
        implantSerial VARCHAR(255) NULL,
        implantLocation VARCHAR(255) NULL,
        patientId VARCHAR(36) NOT NULL,
        doctorId VARCHAR(36) NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY FK_patient_surgeries_patient (patientId),
        CONSTRAINT FK_patient_surgeries_patient FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE patient_surgeries`);
  }
}
