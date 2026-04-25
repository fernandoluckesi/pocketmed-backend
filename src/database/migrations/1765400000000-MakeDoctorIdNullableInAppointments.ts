import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeDoctorIdNullableInAppointments1765400000000 implements MigrationInterface {
  name = 'MakeDoctorIdNullableInAppointments1765400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the existing FK constraint first
    await queryRunner.query(
      `ALTER TABLE \`appointments\` DROP FOREIGN KEY \`FK_appointments_doctor\``,
    );

    // Make doctorId nullable
    await queryRunner.query(
      `ALTER TABLE \`appointments\` MODIFY \`doctorId\` char(36) NULL`,
    );

    // Re-add FK constraint allowing NULL (ON DELETE SET NULL)
    await queryRunner.query(
      `ALTER TABLE \`appointments\` ADD CONSTRAINT \`FK_appointments_doctor\` FOREIGN KEY (\`doctorId\`) REFERENCES \`doctors\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`appointments\` DROP FOREIGN KEY \`FK_appointments_doctor\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`appointments\` MODIFY \`doctorId\` char(36) NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE \`appointments\` ADD CONSTRAINT \`FK_appointments_doctor\` FOREIGN KEY (\`doctorId\`) REFERENCES \`doctors\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
