import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerifiedColumn1774000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`patients\` ADD \`emailVerified\` tinyint NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE \`doctors\` ADD \`emailVerified\` tinyint NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`patients\` DROP COLUMN \`emailVerified\``);
    await queryRunner.query(`ALTER TABLE \`doctors\` DROP COLUMN \`emailVerified\``);
  }
}
