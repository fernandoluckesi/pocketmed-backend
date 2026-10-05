import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrects `reports` table drift: the original `CreateReports` migration ran
 * against this DB before `Report`/`ReportsService` grew the `fileUrl` column
 * and the current `reportType` enum values (both already live in the entity
 * and migration source by the time this is written) — TypeORM tracks
 * migrations by name, so editing an already-executed migration file doesn't
 * re-run it. This brings the actual table in line with what the code expects.
 */
export class FixReportsSchemaDrift1816000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasFileUrl = await queryRunner.hasColumn('reports', 'fileUrl');
    if (!hasFileUrl) {
      await queryRunner.query(`
        ALTER TABLE \`reports\`
        ADD COLUMN \`fileUrl\` varchar(500) NULL AFTER \`documentUrl\`
      `);
    }

    await queryRunner.query(`
      ALTER TABLE \`reports\`
      MODIFY COLUMN \`reportType\` enum('laudo_medico','laudo_exame','relatorio_medico','relatorio_acompanhamento','laudo_administrativo','laudo_trabalhista','laudo_previdenciario','outro') NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`reports\`
      MODIFY COLUMN \`reportType\` enum('relatorio_medico','laudo_exame','parecer_medico','relatorio_alta','laudo_pericial','declaracao_comparecimento','resumo_atendimento','outro') NOT NULL
    `);

    const hasFileUrl = await queryRunner.hasColumn('reports', 'fileUrl');
    if (hasFileUrl) {
      await queryRunner.query('ALTER TABLE `reports` DROP COLUMN `fileUrl`');
    }
  }
}
