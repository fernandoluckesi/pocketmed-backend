import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveUniqueEmailFromPatients1775000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the unique index on email in patients table
    // TypeORM creates it as IDX_<hash> or as a named unique index
    const indexes = await queryRunner.query(
      `SHOW INDEX FROM \`patients\` WHERE Column_name = 'email' AND Non_unique = 0`,
    );
    for (const idx of indexes) {
      if (idx.Key_name !== 'PRIMARY') {
        await queryRunner.query(`ALTER TABLE \`patients\` DROP INDEX \`${idx.Key_name}\``);
      }
    }

    // Add a non-unique index for email lookups
    await queryRunner.query(
      `ALTER TABLE \`patients\` ADD INDEX \`IDX_patients_email\` (\`email\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the non-unique index
    await queryRunner.query(`ALTER TABLE \`patients\` DROP INDEX \`IDX_patients_email\``);
    // Re-add unique constraint
    await queryRunner.query(
      `ALTER TABLE \`patients\` ADD UNIQUE INDEX \`IDX_patients_email_unique\` (\`email\`)`,
    );
  }
}
