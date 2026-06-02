import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientAccessLogs1768000000000 implements MigrationInterface {
  name = 'AddPatientAccessLogs1768000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`patient_access_logs\` (
        \`id\` varchar(36) NOT NULL,
        \`patientId\` varchar(36) NOT NULL,
        \`accessedBy\` varchar(36) NOT NULL,
        \`action\` varchar(50) NOT NULL,
        \`details\` varchar(255) NULL,
        \`ipAddress\` varchar(50) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_patient_access_logs_patient\` (\`patientId\`),
        KEY \`IDX_patient_access_logs_accessed_by\` (\`accessedBy\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`patient_access_logs\`;`);
  }
}
