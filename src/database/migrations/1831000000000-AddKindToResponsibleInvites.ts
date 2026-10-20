import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a `kind` column to dependent_responsible_invites so the same invite
 * table can model two flows:
 *  - 'responsible'    : invite a patient to become a responsible (existing);
 *  - 'admin_transfer' : ask an existing responsible to take over as admin.
 *
 * Defaults to 'responsible' so all existing invites keep their meaning.
 */
export class AddKindToResponsibleInvites1831000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE dependent_responsible_invites
        ADD COLUMN kind ENUM('responsible','admin_transfer')
        NOT NULL DEFAULT 'responsible' AFTER inviteeEmail
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE dependent_responsible_invites DROP COLUMN kind
    `);
  }
}
