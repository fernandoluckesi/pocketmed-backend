import { MigrationInterface, QueryRunner } from 'typeorm';
import { canonicalizeCrm, parseCrm } from '../../common/crm.util';

/**
 * Splits `doctors.crm` into `crmNumber` + `crmUf`.
 *
 * Why: the single `crm` column held several incompatible shapes depending on
 * which client created the account — "123456/SP" (web), "SP-123456" (mobile),
 * "CRM-SP-00001" (clinic seed), "SEC00001" (synthetic, secretaries). Two real
 * consequences: uniqueness checks compared raw strings, so the same doctor
 * could register twice under two shapes; and every lookup had to guess the
 * format (backend tried both, mobile grew three separate parsers).
 *
 * Strategy is expand-and-contract, not a swap: the new columns become the
 * source of truth, while `crm` is kept and backfilled in canonical form.
 * Mobile and backoffice deploy independently and still read `crm` — removing
 * it here would break them mid-rollout. Dropping it is a later, separate
 * migration once those clients have moved over.
 *
 * Backfill reuses `common/crm.util.ts` (the same parser the application uses)
 * rather than re-implementing the rules in SQL, so there's one definition of
 * what a CRM is.
 */
export class SplitDoctorCrmIntoNumberAndUf1813000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('doctors');
    if (!table) return;

    if (!table.findColumnByName('crmNumber')) {
      await queryRunner.query(
        'ALTER TABLE `doctors` ADD COLUMN `crmNumber` varchar(15) NULL AFTER `crm`',
      );
    }
    if (!table.findColumnByName('crmUf')) {
      await queryRunner.query(
        'ALTER TABLE `doctors` ADD COLUMN `crmUf` varchar(2) NULL AFTER `crmNumber`',
      );
    }

    const rows: { id: string; crm: string | null }[] = await queryRunner.query(
      'SELECT `id`, `crm` FROM `doctors`',
    );

    let parsed = 0;
    let unparseable = 0;

    for (const row of rows) {
      const { number, uf } = parseCrm(row.crm);

      if (!number) {
        // Synthetic/garbage CRMs (e.g. "SEC") have nothing to split. Leave the
        // new columns NULL and the legacy value untouched — these accounts are
        // real and must keep working; they simply have no CRM to validate.
        unparseable++;
        continue;
      }

      await queryRunner.query(
        'UPDATE `doctors` SET `crmNumber` = ?, `crmUf` = ?, `crm` = ? WHERE `id` = ?',
        [number, uf || null, canonicalizeCrm(row.crm), row.id],
      );
      parsed++;
    }

    // Index on (crmNumber, crmUf): this is the pair every lookup now filters
    // by, and the pair the CFM web service consults by. Not UNIQUE — existing
    // data may already contain duplicates created under the two old formats,
    // and this migration must not fail on data it didn't create. Enforcing
    // uniqueness is a separate decision after the duplicates are reviewed.
    const hasIndex = (await queryRunner.query(
      "SHOW INDEX FROM `doctors` WHERE Key_name = 'IDX_doctors_crm_number_uf'",
    )) as unknown[];
    if (hasIndex.length === 0) {
      await queryRunner.query(
        'CREATE INDEX `IDX_doctors_crm_number_uf` ON `doctors` (`crmNumber`, `crmUf`)',
      );
    }

    console.log(
      `[SplitDoctorCrm] ${rows.length} médico(s): ${parsed} normalizado(s), ` +
        `${unparseable} sem CRM parseável (colunas novas deixadas NULL).`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('doctors');
    if (!table) return;

    const hasIndex = (await queryRunner.query(
      "SHOW INDEX FROM `doctors` WHERE Key_name = 'IDX_doctors_crm_number_uf'",
    )) as unknown[];
    if (hasIndex.length > 0) {
      await queryRunner.query('DROP INDEX `IDX_doctors_crm_number_uf` ON `doctors`');
    }

    if (table.findColumnByName('crmUf')) {
      await queryRunner.query('ALTER TABLE `doctors` DROP COLUMN `crmUf`');
    }
    if (table.findColumnByName('crmNumber')) {
      await queryRunner.query('ALTER TABLE `doctors` DROP COLUMN `crmNumber`');
    }

    // `crm` is intentionally left in its canonical form. Restoring the old
    // mixed shapes would mean re-introducing the inconsistency this migration
    // fixed, and the canonical form is readable by every client.
  }
}
