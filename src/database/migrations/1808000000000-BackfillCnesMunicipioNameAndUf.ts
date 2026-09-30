import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
import { CNES_MUNICIPIO_MAP } from '../../cnes/data/cnes-municipios';

/**
 * Adds `municipioNome` and `uf` to cnes_establishments (if the table was
 * created by an earlier version of the CreateCnesEstablishments migration that
 * didn't have them) and backfills both columns for every existing row.
 *
 * The CNES API only returns numeric codes, never the município name or the UF
 * abbreviation, so the backfill maps the stored 6-digit `codigoMunicipio` to
 * IBGE's canonical name/UF via a static map (no network access during the
 * migration). Only municípios actually present in the table are updated.
 */
export class BackfillCnesMunicipioNameAndUf1808000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('cnes_establishments');
    if (!table) {
      // Table doesn't exist yet (fresh DB) — the create migration already
      // includes both columns, so there's nothing to backfill.
      return;
    }

    // 1) Add the columns only if they are missing (idempotent across envs:
    //    on a DB created before the columns existed vs. one created after).
    if (!table.findColumnByName('municipioNome')) {
      await queryRunner.addColumn(
        'cnes_establishments',
        new TableColumn({ name: 'municipioNome', type: 'varchar', length: '120', isNullable: true }),
      );
    }
    if (!table.findColumnByName('uf')) {
      await queryRunner.addColumn(
        'cnes_establishments',
        new TableColumn({ name: 'uf', type: 'varchar', length: '2', isNullable: true }),
      );
      await queryRunner.query(
        'CREATE INDEX `IDX_cnes_establishments_uf` ON `cnes_establishments` (`uf`)',
      );
    }

    // 2) Backfill: only touch municípios that actually have rows, and only
    //    rows still missing the data (safe to re-run).
    const rows: { codigoMunicipio: number }[] = await queryRunner.query(
      'SELECT DISTINCT `codigoMunicipio` FROM `cnes_establishments` WHERE `municipioNome` IS NULL OR `uf` IS NULL',
    );

    for (const { codigoMunicipio } of rows) {
      const info = CNES_MUNICIPIO_MAP[String(codigoMunicipio)];
      if (!info) continue; // unknown code — leave nulls rather than guess
      await queryRunner.query(
        'UPDATE `cnes_establishments` SET `municipioNome` = ?, `uf` = ? WHERE `codigoMunicipio` = ?',
        [info.n, info.uf, codigoMunicipio],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Non-destructive revert: just clear the backfilled values. The columns
    // themselves are owned by the create migration when present there.
    const table = await queryRunner.getTable('cnes_establishments');
    if (!table) return;
    if (table.findColumnByName('municipioNome') && table.findColumnByName('uf')) {
      await queryRunner.query(
        'UPDATE `cnes_establishments` SET `municipioNome` = NULL, `uf` = NULL',
      );
    }
  }
}
