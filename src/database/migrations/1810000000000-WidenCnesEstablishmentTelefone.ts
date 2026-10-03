import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Widens cnes_establishments.telefone from VARCHAR(30) to VARCHAR(60): the
 * CNES source data contains dirty phone values with two numbers concatenated
 * (e.g. "11- 36811652 / CEL 11 - 99961540", 32 chars) that overflowed
 * VARCHAR(30) and aborted the national import with ER_DATA_TOO_LONG. The sync
 * also truncates defensively, but the column is widened so the real values fit.
 */
export class WidenCnesEstablishmentTelefone1810000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `cnes_establishments` MODIFY `telefone` VARCHAR(60) NULL;',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `cnes_establishments` MODIFY `telefone` VARCHAR(30) NULL;',
    );
  }
}
