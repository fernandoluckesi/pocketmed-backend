import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSplitUsersToPatientsDoctors1760000000000 implements MigrationInterface {
  name = 'InitialSplitUsersToPatientsDoctors1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`doctors\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`password\` varchar(255) NULL,
        \`gender\` varchar(50) NOT NULL,
        \`phone\` varchar(20) NOT NULL,
        \`birthDate\` date NOT NULL,
        \`profileImage\` varchar(500) NULL,
        \`type\` varchar(20) NOT NULL DEFAULT 'doctor',
        \`isShadow\` tinyint NOT NULL DEFAULT 0,
        \`verificationCode\` varchar(6) NULL,
        \`verificationCodeExpiry\` datetime NULL,
        \`passwordResetCode\` varchar(6) NULL,
        \`passwordResetCodeExpiry\` datetime NULL,
        \`specialty\` varchar(100) NOT NULL,
        \`crm\` varchar(20) NOT NULL,
        \`cpf\` varchar(14) NOT NULL,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_doctors_email\` (\`email\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`patients\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`password\` varchar(255) NULL,
        \`gender\` varchar(50) NOT NULL,
        \`phone\` varchar(20) NOT NULL,
        \`birthDate\` date NOT NULL,
        \`profileImage\` varchar(500) NULL,
        \`type\` varchar(20) NOT NULL DEFAULT 'patient',
        \`isShadow\` tinyint NOT NULL DEFAULT 0,
        \`verificationCode\` varchar(6) NULL,
        \`verificationCodeExpiry\` datetime NULL,
        \`passwordResetCode\` varchar(6) NULL,
        \`passwordResetCodeExpiry\` datetime NULL,
        \`doctorCreatorId\` varchar(36) NULL,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_patients_email\` (\`email\`),
        KEY \`IDX_patients_doctorCreatorId\` (\`doctorCreatorId\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`dependents\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`gender\` varchar(50) NOT NULL,
        \`type\` varchar(50) NOT NULL,
        \`birthDate\` date NOT NULL,
        \`profileImage\` varchar(500) NULL,
        \`adminResponsibleId\` varchar(36) NOT NULL,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_dependents_adminResponsibleId\` (\`adminResponsibleId\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`dependent_responsibles\` (
        \`dependentId\` varchar(36) NOT NULL,
        \`patientId\` varchar(36) NOT NULL,
        PRIMARY KEY (\`dependentId\`, \`patientId\`),
        KEY \`IDX_dependent_responsibles_patientId\` (\`patientId\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`appointments\` (
        \`id\` varchar(36) NOT NULL,
        \`doctorCrm\` varchar(50) NOT NULL,
        \`doctorName\` varchar(255) NOT NULL,
        \`doctorSpecialty\` varchar(100) NOT NULL,
        \`reason\` text NOT NULL,
        \`dateTime\` datetime NOT NULL,
        \`isCompleted\` tinyint NOT NULL DEFAULT 0,
        \`doctorFeedback\` text NULL,
        \`doctorInstructions\` text NULL,
        \`status\` enum('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
        \`doctorId\` varchar(36) NOT NULL,
        \`patientId\` varchar(36) NULL,
        \`dependentId\` varchar(36) NULL,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_appointments_doctorId\` (\`doctorId\`),
        KEY \`IDX_appointments_patientId\` (\`patientId\`),
        KEY \`IDX_appointments_dependentId\` (\`dependentId\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`doctor_access_requests\` (
        \`id\` varchar(36) NOT NULL,
        \`doctorId\` varchar(36) NOT NULL,
        \`patientId\` varchar(36) NULL,
        \`dependentId\` varchar(36) NULL,
        \`status\` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        \`message\` text NULL,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_dar_doctorId\` (\`doctorId\`),
        KEY \`IDX_dar_patientId\` (\`patientId\`),
        KEY \`IDX_dar_dependentId\` (\`dependentId\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`doctor_permissions\` (
        \`id\` varchar(36) NOT NULL,
        \`doctorId\` varchar(36) NOT NULL,
        \`patientId\` varchar(36) NULL,
        \`dependentId\` varchar(36) NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`grantedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_dp_doctorId\` (\`doctorId\`),
        KEY \`IDX_dp_patientId\` (\`patientId\`),
        KEY \`IDX_dp_dependentId\` (\`dependentId\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`medications\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`dosage\` varchar(100) NOT NULL,
        \`frequency\` enum('once_daily','twice_daily','three_times_daily','four_times_daily','every_6_hours','every_8_hours','every_12_hours','as_needed') NOT NULL,
        \`times\` json NULL,
        \`startDate\` date NOT NULL,
        \`endDate\` date NULL,
        \`duration\` int NULL,
        \`instructions\` text NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`isFinished\` tinyint NOT NULL DEFAULT 0,
        \`doctorId\` varchar(36) NOT NULL,
        \`patientId\` varchar(36) NULL,
        \`dependentId\` varchar(36) NULL,
        \`appointmentId\` varchar(36) NULL,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_medications_doctorId\` (\`doctorId\`),
        KEY \`IDX_medications_patientId\` (\`patientId\`),
        KEY \`IDX_medications_dependentId\` (\`dependentId\`),
        KEY \`IDX_medications_appointmentId\` (\`appointmentId\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`exams\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`type\` enum('blood_test','urine_test','xray','ct_scan','mri','ultrasound','ecg','endoscopy','colonoscopy','biopsy','other') NOT NULL,
        \`description\` text NULL,
        \`scheduledDate\` date NULL,
        \`status\` enum('scheduled','completed','cancelled') NOT NULL DEFAULT 'scheduled',
        \`results\` text NULL,
        \`resultFile\` varchar(500) NULL,
        \`observations\` text NULL,
        \`laboratory\` varchar(255) NULL,
        \`doctorId\` varchar(36) NOT NULL,
        \`patientId\` varchar(36) NULL,
        \`dependentId\` varchar(36) NULL,
        \`appointmentId\` varchar(36) NULL,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_exams_doctorId\` (\`doctorId\`),
        KEY \`IDX_exams_patientId\` (\`patientId\`),
        KEY \`IDX_exams_dependentId\` (\`dependentId\`),
        KEY \`IDX_exams_appointmentId\` (\`appointmentId\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(
      'ALTER TABLE `patients` ADD CONSTRAINT `FK_patients_doctorCreator` FOREIGN KEY (`doctorCreatorId`) REFERENCES `doctors`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `dependents` ADD CONSTRAINT `FK_dependents_adminResponsible` FOREIGN KEY (`adminResponsibleId`) REFERENCES `patients`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `dependent_responsibles` ADD CONSTRAINT `FK_dependent_responsibles_dependent` FOREIGN KEY (`dependentId`) REFERENCES `dependents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
    );
    await queryRunner.query(
      'ALTER TABLE `dependent_responsibles` ADD CONSTRAINT `FK_dependent_responsibles_patient` FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
    );

    await queryRunner.query(
      'ALTER TABLE `appointments` ADD CONSTRAINT `FK_appointments_doctor` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `appointments` ADD CONSTRAINT `FK_appointments_patient` FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `appointments` ADD CONSTRAINT `FK_appointments_dependent` FOREIGN KEY (`dependentId`) REFERENCES `dependents`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;',
    );

    await queryRunner.query(
      'ALTER TABLE `doctor_access_requests` ADD CONSTRAINT `FK_dar_doctor` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `doctor_access_requests` ADD CONSTRAINT `FK_dar_patient` FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `doctor_access_requests` ADD CONSTRAINT `FK_dar_dependent` FOREIGN KEY (`dependentId`) REFERENCES `dependents`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;',
    );

    await queryRunner.query(
      'ALTER TABLE `doctor_permissions` ADD CONSTRAINT `FK_dp_doctor` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `doctor_permissions` ADD CONSTRAINT `FK_dp_patient` FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `doctor_permissions` ADD CONSTRAINT `FK_dp_dependent` FOREIGN KEY (`dependentId`) REFERENCES `dependents`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;',
    );

    await queryRunner.query(
      'ALTER TABLE `medications` ADD CONSTRAINT `FK_medications_doctor` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `medications` ADD CONSTRAINT `FK_medications_patient` FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `medications` ADD CONSTRAINT `FK_medications_dependent` FOREIGN KEY (`dependentId`) REFERENCES `dependents`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `medications` ADD CONSTRAINT `FK_medications_appointment` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;',
    );

    await queryRunner.query(
      'ALTER TABLE `exams` ADD CONSTRAINT `FK_exams_doctor` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `exams` ADD CONSTRAINT `FK_exams_patient` FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `exams` ADD CONSTRAINT `FK_exams_dependent` FOREIGN KEY (`dependentId`) REFERENCES `dependents`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `exams` ADD CONSTRAINT `FK_exams_appointment` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `exams`;');
    await queryRunner.query('DROP TABLE IF EXISTS `medications`;');
    await queryRunner.query('DROP TABLE IF EXISTS `doctor_permissions`;');
    await queryRunner.query('DROP TABLE IF EXISTS `doctor_access_requests`;');
    await queryRunner.query('DROP TABLE IF EXISTS `appointments`;');
    await queryRunner.query('DROP TABLE IF EXISTS `dependent_responsibles`;');
    await queryRunner.query('DROP TABLE IF EXISTS `dependents`;');
    await queryRunner.query('DROP TABLE IF EXISTS `patients`;');
    await queryRunner.query('DROP TABLE IF EXISTS `doctors`;');
  }
}
