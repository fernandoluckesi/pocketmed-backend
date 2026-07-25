import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddObservationsToPatientDiseases1772100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE patient_diseases ADD COLUMN observations TEXT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE patient_diseases DROP COLUMN observations`);
  }
}
