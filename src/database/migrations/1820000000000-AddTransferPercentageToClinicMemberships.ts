import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Doctor transfer (repasse) percentage was clinic-wide only
 * (FinancialSettings.defaultDoctorTransferPercentage), applied uniformly to
 * every doctor. Clinics commonly negotiate a different split per doctor, so
 * this adds a per-membership override; null keeps using the clinic default.
 */
export class AddTransferPercentageToClinicMemberships1820000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`clinic_memberships\`
      ADD COLUMN \`transferPercentage\` DECIMAL(5,2) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`clinic_memberships\`
      DROP COLUMN \`transferPercentage\`
    `);
  }
}
