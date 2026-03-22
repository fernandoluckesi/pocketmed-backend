import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvailabilityTables1761000000000 implements MigrationInterface {
  name = 'AddAvailabilityTables1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`availability_rules\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(100) NULL,
        \`weekly\` json NOT NULL,
        \`duration\` int NOT NULL DEFAULT 30,
        \`buffer\` int NOT NULL DEFAULT 0,
        \`doctorId\` varchar(36) NOT NULL,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_availability_rules_doctorId\` (\`doctorId\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`availability_exceptions\` (
        \`id\` varchar(36) NOT NULL,
        \`type\` enum('single','range') NOT NULL DEFAULT 'single',
        \`date\` date NULL,
        \`startDate\` date NULL,
        \`endDate\` date NULL,
        \`fullDay\` tinyint NOT NULL DEFAULT 1,
        \`startTime\` varchar(5) NULL,
        \`endTime\` varchar(5) NULL,
        \`reason\` varchar(255) NULL,
        \`doctorId\` varchar(36) NOT NULL,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_availability_exceptions_doctorId\` (\`doctorId\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(
      'ALTER TABLE `availability_rules` ADD CONSTRAINT `FK_availability_rules_doctor` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;',
    );
    await queryRunner.query(
      'ALTER TABLE `availability_exceptions` ADD CONSTRAINT `FK_availability_exceptions_doctor` FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `availability_exceptions`;');
    await queryRunner.query('DROP TABLE IF EXISTS `availability_rules`;');
  }
}
