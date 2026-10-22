import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enables MULTIPLE admins per dependent. Until now a dependent had a single
 * `dependents.adminResponsibleId`. We add an `isAdmin` flag to the
 * `dependent_responsibles` join table so any number of responsibles can be
 * admins at once.
 *
 * Backfill: every current admin (the existing adminResponsibleId) is marked
 * isAdmin=true on their join row, so no one loses admin rights. The legacy
 * `adminResponsibleId` column is kept as the "root/creator" admin because the
 * account-deletion and shadow-merge flows still reference it in raw SQL.
 */
export class AddIsAdminToDependentResponsibles1832000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE dependent_responsibles
        ADD COLUMN isAdmin TINYINT(1) NOT NULL DEFAULT 0
    `);

    // Backfill: the current admin of each dependent becomes isAdmin=true.
    await queryRunner.query(`
      UPDATE dependent_responsibles dr
      JOIN dependents d ON d.id = dr.dependentId
      SET dr.isAdmin = 1
      WHERE dr.patientId = d.adminResponsibleId
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE dependent_responsibles DROP COLUMN isAdmin
    `);
  }
}
