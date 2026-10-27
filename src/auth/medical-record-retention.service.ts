import { Injectable, Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';

/**
 * Decides whether an account can be erased outright or must be kept for the
 * medical-record retention period, and performs the anonymisation when it
 * must be kept.
 *
 * Why this exists as its own service: `auth.service.ts` is already ~2300
 * lines, and this is a self-contained legal rule that is easier to reason
 * about (and to test) in isolation.
 *
 * The rule, in one line: **the clinical record survives, the person's
 * identity on the platform does not.**
 *
 * Legal basis
 * -----------
 * - CFM Res. 1.821/2007 requires keeping the medical record for 20 years
 *   from the last entry. That duty belongs to the professional and the
 *   institution, and does not depend on anyone's consent.
 * - LGPD art. 18, VI gives the data subject the right to erasure, but
 *   art. 16 explicitly allows retaining data to comply with a legal or
 *   regulatory obligation.
 *
 * So there is no real conflict — there is an exception written into the law.
 * What matters is being precise about WHAT is kept and for HOW LONG, which
 * is exactly what the Privacy Policy §7 states.
 */
@Injectable()
export class MedicalRecordRetentionService {
  private readonly logger = new Logger(MedicalRecordRetentionService.name);

  /** CFM Res. 1.821/2007, art. 8. */
  static readonly RETENTION_YEARS = 20;

  /**
   * Tables that constitute the medical record, with the column linking them
   * to a patient id.
   *
   * `appointments`, `medications` and `exams` are deliberately NOT here:
   * they are scheduling/tracking data rather than issued clinical documents,
   * and the existing deletion flow already removes them. Keeping the list
   * tight is the point — every table listed here is data a deletion request
   * will NOT erase, so the list has to be defensible item by item.
   */
  private static readonly MEDICAL_RECORD_TABLES: ReadonlyArray<{
    table: string;
    patientColumn: string;
  }> = [
    { table: 'prescriptions', patientColumn: 'patientId' },
    { table: 'reports', patientColumn: 'patientId' },
    { table: 'certificates', patientColumn: 'patientId' },
    { table: 'exam_requests', patientColumn: 'patientId' },
  ];

  /**
   * True when this patient (or dependent) has at least one issued clinical
   * document, i.e. there is a retention duty to honour.
   *
   * Checked with EXISTS rather than COUNT: we only need to know whether
   * there is any, and it short-circuits on the first hit.
   */
  async hasMedicalRecord(
    queryRunner: QueryRunner,
    id: string,
    opts: { isDependent: boolean } = { isDependent: false },
  ): Promise<boolean> {
    const column = opts.isDependent ? 'dependentId' : 'patientId';

    for (const { table } of MedicalRecordRetentionService.MEDICAL_RECORD_TABLES) {
      const rows = await queryRunner.query(
        `SELECT EXISTS(SELECT 1 FROM \`${table}\` WHERE \`${column}\` = ?) AS found`,
        [id],
      );
      if (Number(rows[0]?.found) === 1) return true;
    }
    return false;
  }

  /** Same question for a doctor: did they issue any document? Their CRM is on
   * every one of them, so the same retention duty applies. */
  async doctorHasIssuedDocuments(queryRunner: QueryRunner, doctorId: string): Promise<boolean> {
    for (const { table } of MedicalRecordRetentionService.MEDICAL_RECORD_TABLES) {
      const rows = await queryRunner.query(
        `SELECT EXISTS(SELECT 1 FROM \`${table}\` WHERE \`doctorId\` = ?) AS found`,
        [doctorId],
      );
      if (Number(rows[0]?.found) === 1) return true;
    }
    return false;
  }

  /**
   * Latest clinical entry for an id, across every medical-record table, plus
   * the retention years. Returns null when there is no record at all.
   *
   * The CFM clock runs from the LAST entry, not the first — so this has to
   * look at every table and take the maximum.
   */
  async computeRetentionUntil(
    queryRunner: QueryRunner,
    id: string,
    opts: { isDoctor?: boolean; isDependent?: boolean } = {},
  ): Promise<Date | null> {
    const column = opts.isDoctor ? 'doctorId' : opts.isDependent ? 'dependentId' : 'patientId';

    let latest: Date | null = null;
    for (const { table } of MedicalRecordRetentionService.MEDICAL_RECORD_TABLES) {
      const rows = await queryRunner.query(
        `SELECT MAX(\`createdAt\`) AS last FROM \`${table}\` WHERE \`${column}\` = ?`,
        [id],
      );
      const value = rows[0]?.last;
      if (!value) continue;
      const date = value instanceof Date ? value : new Date(value);
      if (!latest || date > latest) latest = date;
    }

    if (!latest) return null;

    const until = new Date(latest);
    until.setFullYear(until.getFullYear() + MedicalRecordRetentionService.RETENTION_YEARS);
    return until;
  }

  /**
   * Strips everything that identifies the person as a platform user, keeping
   * only what the retained record needs to remain a valid medical record.
   *
   * Kept: name, CPF, birth date, gender — without them the record does not
   * identify its subject, which defeats the very duty being honoured.
   * Erased: e-mail, phone, profile image, password hash, verification codes,
   * push/notification state, address, and (for doctors) nothing of the CRM,
   * since it is part of the issued documents' validity.
   *
   * The e-mail is nulled rather than left in place so the address frees up
   * for a new signup — same reasoning as the `cpfUnique` index change in
   * migration 1835.
   */
  async anonymisePatientForRetention(
    queryRunner: QueryRunner,
    patientId: string,
    retentionUntil: Date | null,
  ): Promise<void> {
    await queryRunner.query(
      `UPDATE \`patients\` SET
         \`email\` = NULL,
         \`phone\` = NULL,
         \`phoneNormalized\` = NULL,
         \`username\` = NULL,
         \`profileImage\` = NULL,
         \`password\` = NULL,
         \`verificationCode\` = NULL,
         \`verificationCodeExpiry\` = NULL,
         \`passwordResetCode\` = NULL,
         \`passwordResetCodeExpiry\` = NULL,
         \`pendingEmail\` = NULL,
         \`emailChangeCode\` = NULL,
         \`emailChangeCodeExpiry\` = NULL,
         \`deletionRequestedAt\` = NOW(),
         \`retentionUntil\` = ?,
         \`deletedAt\` = NOW(6)
       WHERE \`id\` = ?`,
      [retentionUntil ? this.toDateOnly(retentionUntil) : null, patientId],
    );
  }

  async anonymiseDoctorForRetention(
    queryRunner: QueryRunner,
    doctorId: string,
    retentionUntil: Date | null,
  ): Promise<void> {
    // CRM/name are kept on purpose: they authenticate the documents this
    // professional signed. Contact details and credentials are not.
    await queryRunner.query(
      `UPDATE \`doctors\` SET
         \`email\` = NULL,
         \`phone\` = NULL,
         \`phoneNormalized\` = NULL,
         \`profileImage\` = NULL,
         \`password\` = NULL,
         \`verificationCode\` = NULL,
         \`verificationCodeExpiry\` = NULL,
         \`passwordResetCode\` = NULL,
         \`passwordResetCodeExpiry\` = NULL,
         \`pendingEmail\` = NULL,
         \`emailChangeCode\` = NULL,
         \`emailChangeCodeExpiry\` = NULL,
         \`deletionRequestedAt\` = NOW(),
         \`retentionUntil\` = ?,
         \`deletedAt\` = NOW(6)
       WHERE \`id\` = ?`,
      [retentionUntil ? this.toDateOnly(retentionUntil) : null, doctorId],
    );
  }

  /** MySQL `date` column wants YYYY-MM-DD. */
  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * Accounts whose retention period has expired and can finally be erased.
   * Consumed by the retention job.
   */
  async findExpiredRetentions(
    queryRunner: QueryRunner,
  ): Promise<Array<{ id: string; type: 'patient' | 'doctor' }>> {
    const patients: { id: string }[] = await queryRunner.query(
      `SELECT \`id\` FROM \`patients\`
       WHERE \`deletedAt\` IS NOT NULL
         AND \`retentionUntil\` IS NOT NULL
         AND \`retentionUntil\` <= CURDATE()`,
    );
    const doctors: { id: string }[] = await queryRunner.query(
      `SELECT \`id\` FROM \`doctors\`
       WHERE \`deletedAt\` IS NOT NULL
         AND \`retentionUntil\` IS NOT NULL
         AND \`retentionUntil\` <= CURDATE()`,
    );

    return [
      ...patients.map((p) => ({ id: p.id, type: 'patient' as const })),
      ...doctors.map((d) => ({ id: d.id, type: 'doctor' as const })),
    ];
  }

  /**
   * Erases the retained clinical documents for an id whose retention expired.
   *
   * Explicit per-table deletes, in dependency order, because migration 1835
   * replaced the FK CASCADE with RESTRICT — precisely so this can never
   * happen by accident, only here, on purpose.
   */
  async purgeMedicalRecord(
    queryRunner: QueryRunner,
    id: string,
    opts: { isDoctor?: boolean } = {},
  ): Promise<void> {
    const column = opts.isDoctor ? 'doctorId' : 'patientId';

    for (const { table } of MedicalRecordRetentionService.MEDICAL_RECORD_TABLES) {
      await queryRunner.query(`DELETE FROM \`${table}\` WHERE \`${column}\` = ?`, [id]);
    }

    this.logger.log(
      `Purged retained medical record for ${opts.isDoctor ? 'doctor' : 'patient'} ${id} ` +
        `(retention period expired)`,
    );
  }
}
