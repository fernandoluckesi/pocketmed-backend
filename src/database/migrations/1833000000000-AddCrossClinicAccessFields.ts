import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the cross-clinic record-sharing authorization fields to the existing
 * `doctor_access_requests` (a request) and `doctor_permissions` (a grant)
 * tables, instead of creating parallel entities — the two already model
 * exactly "doctor requests access to a patient, patient approves, a
 * permission is created" (see `doctors.service.ts`). All new columns are
 * nullable: the original same-clinic in-app flow never sets any of them.
 */
export class AddCrossClinicAccessFields1833000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE doctor_access_requests
        MODIFY COLUMN status ENUM('pending','approved','rejected','expired','revoked','cancelled')
          NOT NULL DEFAULT 'pending',
        ADD COLUMN requestingClinicId VARCHAR(36) NULL,
        ADD COLUMN purpose VARCHAR(255) NULL,
        ADD COLUMN channel ENUM('in_app','email_link') NULL,
        ADD COLUMN consentTokenHash VARCHAR(64) NULL,
        ADD COLUMN consentTokenExpiresAt DATETIME NULL,
        ADD COLUMN consentTextVersion VARCHAR(20) NULL,
        ADD COLUMN linkSentAt DATETIME NULL
    `);

    // Look up a pending email-link request by its token hash without a full
    // table scan; token verification is on the hot path of a public endpoint.
    await queryRunner.query(`
      CREATE INDEX IDX_dar_consentTokenHash ON doctor_access_requests (consentTokenHash)
    `);

    await queryRunner.query(`
      ALTER TABLE doctor_permissions
        ADD COLUMN expiresAt DATETIME NULL,
        ADD COLUMN sourceRequestId VARCHAR(36) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE doctor_permissions
        DROP COLUMN expiresAt,
        DROP COLUMN sourceRequestId
    `);

    await queryRunner.query(`
      DROP INDEX IDX_dar_consentTokenHash ON doctor_access_requests
    `);

    await queryRunner.query(`
      ALTER TABLE doctor_access_requests
        DROP COLUMN requestingClinicId,
        DROP COLUMN purpose,
        DROP COLUMN channel,
        DROP COLUMN consentTokenHash,
        DROP COLUMN consentTokenExpiresAt,
        DROP COLUMN consentTextVersion,
        DROP COLUMN linkSentAt,
        MODIFY COLUMN status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'
    `);
  }
}
