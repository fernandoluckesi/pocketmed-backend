import { MedicalRecordRetentionService } from './medical-record-retention.service';
import { QueryRunner } from 'typeorm';

/**
 * Unit coverage for the retention rule behind audit finding R3
 * (see archives/docs/legal/R3-plano-retencao-prontuario.md).
 *
 * The rule: the clinical record survives an account deletion, the person's
 * platform identity does not. Getting this wrong fails in one of two
 * directions, and both matter:
 *
 *  - erasing a record that must be kept → breach of CFM Res. 1.821/2007;
 *  - keeping an account that could be erased → breach of LGPD art. 18, VI.
 *
 * So the tests pin both branches, not just the retention one.
 */

/** Minimal QueryRunner stub that records the SQL it was asked to run and
 * replies from a scripted map of responses. */
function queryRunnerStub(responder: (sql: string, params?: unknown[]) => unknown) {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const qr = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return responder(sql, params);
    }),
  } as unknown as QueryRunner;
  return { qr, calls };
}

const PATIENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DOCTOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('MedicalRecordRetentionService', () => {
  let service: MedicalRecordRetentionService;

  beforeEach(() => {
    service = new MedicalRecordRetentionService();
  });

  describe('hasMedicalRecord', () => {
    it('is false when the patient has no issued document', () => {
      // The erasable case: signed up, never treated. Must stay a hard delete,
      // otherwise we would retain data with no legal duty to justify it.
      const { qr } = queryRunnerStub(() => [{ found: 0 }]);
      return expect(service.hasMedicalRecord(qr, PATIENT_ID)).resolves.toBe(false);
    });

    it('is true when any single table has a document', async () => {
      // Only `certificates` answers positively — one document is enough to
      // trigger the retention duty.
      const { qr } = queryRunnerStub((sql) =>
        sql.includes('`certificates`') ? [{ found: 1 }] : [{ found: 0 }],
      );
      await expect(service.hasMedicalRecord(qr, PATIENT_ID)).resolves.toBe(true);
    });

    it('checks every medical-record table', async () => {
      const { qr, calls } = queryRunnerStub(() => [{ found: 0 }]);
      await service.hasMedicalRecord(qr, PATIENT_ID);

      const sql = calls.map((c) => c.sql).join(' ');
      for (const table of ['prescriptions', 'reports', 'certificates', 'exam_requests']) {
        expect(sql).toContain(`\`${table}\``);
      }
    });

    it('short-circuits on the first table that has a record', async () => {
      // `prescriptions` is checked first; finding a record there means the
      // remaining tables need not be queried.
      const { qr, calls } = queryRunnerStub(() => [{ found: 1 }]);
      await service.hasMedicalRecord(qr, PATIENT_ID);
      expect(calls).toHaveLength(1);
    });

    it('keys on dependentId for a dependent', async () => {
      // A minor's documents hang off `dependentId`, not `patientId` — using
      // the wrong column would report "no record" and erase a minor's data.
      const { qr, calls } = queryRunnerStub(() => [{ found: 0 }]);
      await service.hasMedicalRecord(qr, PATIENT_ID, { isDependent: true });

      expect(calls[0].sql).toContain('`dependentId`');
      expect(calls[0].sql).not.toContain('`patientId`');
    });
  });

  describe('doctorHasIssuedDocuments', () => {
    it('keys on doctorId', async () => {
      const { qr, calls } = queryRunnerStub(() => [{ found: 0 }]);
      await service.doctorHasIssuedDocuments(qr, DOCTOR_ID);
      expect(calls[0].sql).toContain('`doctorId`');
    });

    it('is true when the doctor signed anything', async () => {
      // The doctor's name and CRM authenticate every document they signed,
      // so the same retention duty applies to them.
      const { qr } = queryRunnerStub((sql) =>
        sql.includes('`reports`') ? [{ found: 1 }] : [{ found: 0 }],
      );
      await expect(service.doctorHasIssuedDocuments(qr, DOCTOR_ID)).resolves.toBe(true);
    });
  });

  describe('computeRetentionUntil', () => {
    it('returns null when there is no clinical entry', async () => {
      const { qr } = queryRunnerStub(() => [{ last: null }]);
      await expect(service.computeRetentionUntil(qr, PATIENT_ID)).resolves.toBeNull();
    });

    it('counts 20 years from the entry date', async () => {
      const { qr } = queryRunnerStub((sql) =>
        sql.includes('`prescriptions`')
          ? [{ last: new Date('2020-03-15T10:00:00Z') }]
          : [{ last: null }],
      );

      const until = await service.computeRetentionUntil(qr, PATIENT_ID);
      expect(until?.getUTCFullYear()).toBe(2040);
      expect(until?.getUTCMonth()).toBe(2); // March
      expect(until?.getUTCDate()).toBe(15);
    });

    it('counts from the LATEST entry across all tables', async () => {
      // CFM Res. 1.821/2007 runs the clock from the last entry, not the
      // first — taking the earliest would under-retain.
      const dates: Record<string, Date> = {
        prescriptions: new Date('2018-01-01T00:00:00Z'),
        reports: new Date('2023-06-30T00:00:00Z'), // latest
        certificates: new Date('2020-01-01T00:00:00Z'),
      };
      const { qr } = queryRunnerStub((sql) => {
        for (const [table, date] of Object.entries(dates)) {
          if (sql.includes(`\`${table}\``)) return [{ last: date }];
        }
        return [{ last: null }];
      });

      const until = await service.computeRetentionUntil(qr, PATIENT_ID);
      expect(until?.getUTCFullYear()).toBe(2043);
      expect(until?.getUTCMonth()).toBe(5); // June
    });

    it('accepts a date returned as a string by the driver', async () => {
      // mysql2 may hand back a string depending on connection flags.
      const { qr } = queryRunnerStub((sql) =>
        sql.includes('`reports`') ? [{ last: '2021-12-01 08:30:00' }] : [{ last: null }],
      );
      const until = await service.computeRetentionUntil(qr, PATIENT_ID);
      expect(until?.getFullYear()).toBe(2041);
    });

    it('keys on doctorId when asked for a doctor', async () => {
      const { qr, calls } = queryRunnerStub(() => [{ last: null }]);
      await service.computeRetentionUntil(qr, DOCTOR_ID, { isDoctor: true });
      expect(calls[0].sql).toContain('`doctorId`');
    });

    it('exposes the retention period as 20 years', () => {
      expect(MedicalRecordRetentionService.RETENTION_YEARS).toBe(20);
    });
  });

  describe('anonymisePatientForRetention', () => {
    it('clears contact and credential fields but not the identity', async () => {
      const { qr, calls } = queryRunnerStub(() => []);
      await service.anonymisePatientForRetention(qr, PATIENT_ID, new Date('2040-01-01'));

      const sql = calls[0].sql;
      // Erased: everything that makes the row a usable account.
      for (const field of [
        'email',
        'phone',
        'phoneNormalized',
        'username',
        'profileImage',
        'password',
        'verificationCode',
        'passwordResetCode',
        'pendingEmail',
      ]) {
        expect(sql).toContain(`\`${field}\` = NULL`);
      }
      // Kept: without name/CPF the retained record no longer identifies its
      // subject, which would defeat the duty being honoured.
      expect(sql).not.toContain('`name` = NULL');
      expect(sql).not.toContain('`cpf` = NULL');
      expect(sql).not.toContain('`birthDate` = NULL');
    });

    it('stamps deletedAt, deletionRequestedAt and retentionUntil', async () => {
      const { qr, calls } = queryRunnerStub(() => []);
      await service.anonymisePatientForRetention(qr, PATIENT_ID, new Date('2040-05-20'));

      expect(calls[0].sql).toContain('`deletedAt` = NOW(6)');
      expect(calls[0].sql).toContain('`deletionRequestedAt` = NOW()');
      // MySQL `date` column wants YYYY-MM-DD.
      expect(calls[0].params?.[0]).toBe('2040-05-20');
    });

    it('accepts a null retentionUntil', async () => {
      const { qr, calls } = queryRunnerStub(() => []);
      await service.anonymisePatientForRetention(qr, PATIENT_ID, null);
      expect(calls[0].params?.[0]).toBeNull();
    });
  });

  describe('anonymiseDoctorForRetention', () => {
    it('keeps name and CRM, which authenticate signed documents', async () => {
      const { qr, calls } = queryRunnerStub(() => []);
      await service.anonymiseDoctorForRetention(qr, DOCTOR_ID, new Date('2040-01-01'));

      const sql = calls[0].sql;
      expect(sql).toContain('`email` = NULL');
      expect(sql).toContain('`password` = NULL');
      expect(sql).not.toContain('`crm` = NULL');
      expect(sql).not.toContain('`name` = NULL');
    });
  });

  describe('purgeMedicalRecord', () => {
    it('deletes from every medical-record table explicitly', async () => {
      // Migration 1835 replaced the FK CASCADE with RESTRICT precisely so the
      // record can never be destroyed implicitly — only here, on purpose.
      const { qr, calls } = queryRunnerStub(() => []);
      await service.purgeMedicalRecord(qr, PATIENT_ID);

      const sql = calls.map((c) => c.sql).join(' ');
      for (const table of ['prescriptions', 'reports', 'certificates', 'exam_requests']) {
        expect(sql).toContain(`DELETE FROM \`${table}\``);
      }
    });

    it('keys on doctorId for a doctor', async () => {
      const { qr, calls } = queryRunnerStub(() => []);
      await service.purgeMedicalRecord(qr, DOCTOR_ID, { isDoctor: true });
      expect(calls[0].sql).toContain('`doctorId`');
    });
  });

  describe('findExpiredRetentions', () => {
    it('only returns rows whose retention has actually lapsed', async () => {
      const { qr, calls } = queryRunnerStub((sql) =>
        sql.includes('`patients`') ? [{ id: PATIENT_ID }] : [{ id: DOCTOR_ID }],
      );

      const expired = await service.findExpiredRetentions(qr);

      expect(expired).toEqual([
        { id: PATIENT_ID, type: 'patient' },
        { id: DOCTOR_ID, type: 'doctor' },
      ]);
      // The guard that keeps a still-valid retention from being purged early.
      for (const call of calls) {
        expect(call.sql).toContain('`retentionUntil` <= CURDATE()');
        expect(call.sql).toContain('`deletedAt` IS NOT NULL');
      }
    });
  });
});
