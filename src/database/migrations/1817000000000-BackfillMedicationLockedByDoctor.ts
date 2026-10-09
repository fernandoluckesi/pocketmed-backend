import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One-time data correction: `medications.service.ts`'s `create()` never set
 * `lockedByDoctor` at all until this same change, so every medication a
 * doctor ever prescribed through the web app defaulted to the column's
 * `false` — the mobile app's entire lock UI (disabled fields, hidden
 * Finalizar/Excluir, the "Registro médico" chip) depends on this flag, so in
 * practice nothing a doctor prescribed was ever actually locked for the
 * patient.
 *
 * Deliberately conservative: only backfills rows where `doctorId` is set AND
 * `appointmentId` is NULL (the standalone "Adicionar Medicamento" flow) —
 * that combination is unambiguous. A medication with both `doctorId` AND
 * `appointmentId` set is NOT backfilled here, because that same shape is
 * produced by two different flows that can't be told apart after the fact
 * from this table alone: a doctor prescribing *during* a consultation, and a
 * patient self-reporting a medication *during their own* consultation. There
 * is no audit trail for medication creation to disambiguate them. Fixing
 * that overlap, if ever done, needs its own explicit decision — not a blind
 * backfill that risks locking a patient out of editing their own entry.
 */
export class BackfillMedicationLockedByDoctor1817000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`medications\`
      SET \`lockedByDoctor\` = 1
      WHERE \`doctorId\` IS NOT NULL
        AND \`appointmentId\` IS NULL
        AND \`lockedByDoctor\` = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Symmetric revert of the same unambiguous subset. Not guaranteed to be
    // byte-for-byte the original state if any of these rows were
    // legitimately re-locked by other means after this migration ran —
    // acceptable for a one-time data correction like this one.
    await queryRunner.query(`
      UPDATE \`medications\`
      SET \`lockedByDoctor\` = 0
      WHERE \`doctorId\` IS NOT NULL
        AND \`appointmentId\` IS NULL
    `);
  }
}
