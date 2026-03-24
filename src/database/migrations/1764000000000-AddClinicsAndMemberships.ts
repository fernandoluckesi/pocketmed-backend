import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClinicsAndMemberships1764000000000 implements MigrationInterface {
  name = 'AddClinicsAndMemberships1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`clinics\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`cnpj\` varchar(18) NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`clinic_memberships\` (
        \`id\` varchar(36) NOT NULL,
        \`clinicId\` varchar(36) NOT NULL,
        \`professionalId\` varchar(36) NOT NULL,
        \`role\` varchar(20) NOT NULL DEFAULT 'doctor',
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`invitedBy\` varchar(36) NULL,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_clinic_memberships_clinic_professional\` (\`clinicId\`, \`professionalId\`),
        KEY \`IDX_clinic_memberships_clinic\` (\`clinicId\`),
        KEY \`IDX_clinic_memberships_professional\` (\`professionalId\`),
        KEY \`IDX_clinic_memberships_invitedBy\` (\`invitedBy\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(
      'ALTER TABLE `clinic_memberships` ADD CONSTRAINT `FK_clinic_memberships_clinic` FOREIGN KEY (`clinicId`) REFERENCES `clinics`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `clinic_memberships` ADD CONSTRAINT `FK_clinic_memberships_professional` FOREIGN KEY (`professionalId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `clinic_memberships` ADD CONSTRAINT `FK_clinic_memberships_invitedBy` FOREIGN KEY (`invitedBy`) REFERENCES `doctors`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `clinic_memberships` DROP FOREIGN KEY `FK_clinic_memberships_invitedBy`;',
    );
    await queryRunner.query(
      'ALTER TABLE `clinic_memberships` DROP FOREIGN KEY `FK_clinic_memberships_professional`;',
    );
    await queryRunner.query(
      'ALTER TABLE `clinic_memberships` DROP FOREIGN KEY `FK_clinic_memberships_clinic`;',
    );
    await queryRunner.query('DROP TABLE IF EXISTS `clinic_memberships`;');
    await queryRunner.query('DROP TABLE IF EXISTS `clinics`;');
  }
}
