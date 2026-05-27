import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRqeToDoctors1766300000000 implements MigrationInterface {
  name = 'AddRqeToDoctors1766300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`doctors\` ADD COLUMN \`rqe\` varchar(20) NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`doctors\` DROP COLUMN \`rqe\`;`,
    );
  }
}
