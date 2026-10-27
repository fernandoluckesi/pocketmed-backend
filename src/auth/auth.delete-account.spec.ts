import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { Patient } from '../entities/patient.entity';
import { Doctor } from '../entities/doctor.entity';
import { Clinic } from '../entities/clinic.entity';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { ClinicAdminProfile } from '../entities/clinic-admin-profile.entity';
import { Secretary } from '../entities/secretary.entity';
import { DoctorPermission } from '../entities/doctor-permission.entity';
import { DoctorDocument } from '../entities/doctor-document.entity';
import { UploadService } from '../upload/upload.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { MedicalRecordRetentionService } from './medical-record-retention.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TurnstileService } from '../common/turnstile/turnstile.service';

/**
 * Unit tests for AuthService.deleteAccount focusing on the hard-delete
 * completeness and the dependent handling. The DB is faked through a recorded
 * query runner so we can assert exactly which tables/ids get DELETEd and that
 * stored files are cleaned up only after a successful commit.
 */
describe('AuthService - deleteAccount', () => {
  let service: AuthService;
  let patientRepo: { findOne: jest.Mock };
  let deleteFile: jest.Mock;
  let recordDelete: jest.Mock;

  // Records every SQL statement issued inside the transaction.
  let queries: { sql: string; params: any[] }[];
  let committed: boolean;
  let rolledBack: boolean;

  const USER_ID = 'patient-1';
  const VALID_CODE = '123456';

  // Rows returned by SELECTs the service runs during deletion. Configurable
  // per test to simulate dependents / files.
  let selectResponses: {
    adminDependents?: { dependentId: string }[];
    dependentAdminsById?: Record<string, { patientId: string }[]>;
    examResultsById?: Record<string, { resultFile: string | null; resultFiles: any }[]>;
    dependentProfileById?: Record<string, { profileImage: string | null }[]>;
    patientProfile?: { profileImage: string | null }[];
    /** Tables that should report an existing clinical document, keyed by the
     * id being checked. Drives the retention-vs-hard-delete decision. */
    medicalRecordByIdAndTable?: Record<string, string[]>;
    /** Latest clinical entry per table, used to compute retentionUntil. */
    lastEntryByTable?: Record<string, Date>;
  };

  function makeQueryRunner() {
    return {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockImplementation(() => {
        committed = true;
        return Promise.resolve();
      }),
      rollbackTransaction: jest.fn().mockImplementation(() => {
        rolledBack = true;
        return Promise.resolve();
      }),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockImplementation((sql: string, params: any[] = []) => {
        queries.push({ sql, params });

        // Dependents where the user is an admin (via the join flag).
        if (
          sql.includes('SELECT `dependentId` FROM `dependent_responsibles`') &&
          sql.includes('isAdmin')
        ) {
          return Promise.resolve(selectResponses.adminDependents ?? []);
        }
        // Admins of a given dependent (to decide delete vs unlink).
        if (
          sql.includes('SELECT `patientId` FROM `dependent_responsibles`') &&
          sql.includes('isAdmin')
        ) {
          const depId = params[0];
          return Promise.resolve(selectResponses.dependentAdminsById?.[depId] ?? []);
        }
        if (sql.includes('SELECT `resultFile`, `resultFiles` FROM `exams`')) {
          const id = params[0];
          return Promise.resolve(selectResponses.examResultsById?.[id] ?? []);
        }
        if (sql.includes('SELECT `profileImage` FROM `dependents`')) {
          const id = params[0];
          return Promise.resolve(selectResponses.dependentProfileById?.[id] ?? []);
        }
        if (sql.includes('SELECT `profileImage` FROM `patients`')) {
          return Promise.resolve(selectResponses.patientProfile ?? [{ profileImage: null }]);
        }
        // Retention: does this id have any issued clinical document?
        if (sql.includes('SELECT EXISTS(')) {
          const id = params[0];
          const tables = selectResponses.medicalRecordByIdAndTable?.[id] ?? [];
          const found = tables.some((t) => sql.includes(`\`${t}\``));
          return Promise.resolve([{ found: found ? 1 : 0 }]);
        }
        // Retention: latest entry, to derive retentionUntil.
        if (sql.includes('MAX(`createdAt`)')) {
          const entries = selectResponses.lastEntryByTable ?? {};
          const hit = Object.entries(entries).find(([t]) => sql.includes(`\`${t}\``));
          return Promise.resolve([{ last: hit ? hit[1] : null }]);
        }
        return Promise.resolve([]);
      }),
    };
  }

  beforeEach(async () => {
    queries = [];
    committed = false;
    rolledBack = false;
    selectResponses = {};

    patientRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: USER_ID,
        type: 'patient',
        verificationCode: VALID_CODE,
        verificationCodeExpiry: new Date(Date.now() + 10 * 60 * 1000),
      }),
    };

    deleteFile = jest.fn().mockResolvedValue(undefined);
    recordDelete = jest.fn().mockResolvedValue(undefined);

    const dataSource = {
      createQueryRunner: jest.fn(() => makeQueryRunner()),
    } as unknown as DataSource;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: getRepositoryToken(Doctor), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Clinic), useValue: {} },
        { provide: getRepositoryToken(ClinicMembership), useValue: {} },
        { provide: getRepositoryToken(ClinicAdminProfile), useValue: {} },
        { provide: getRepositoryToken(Secretary), useValue: {} },
        { provide: getRepositoryToken(DoctorPermission), useValue: {} },
        { provide: getRepositoryToken(DoctorDocument), useValue: {} },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: UploadService, useValue: { deleteFile } },
        { provide: EmailService, useValue: { sendAccountDeletionCode: jest.fn() } },
        { provide: AuditService, useValue: { recordDelete } },
        MedicalRecordRetentionService,
        { provide: NotificationsService, useValue: { createNotification: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: { get: jest.fn(() => undefined) } },
        { provide: TurnstileService, useValue: { verify: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  const deletedTables = () =>
    queries
      .filter((q) => q.sql.trimStart().startsWith('DELETE'))
      .map((q) => q.sql.match(/DELETE FROM `(\w+)`/)?.[1])
      .filter(Boolean);

  it('rejects an invalid verification code without touching the DB', async () => {
    await expect(service.deleteAccount(USER_ID, 'patient', 'wrong')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(queries).toHaveLength(0);
  });

  it('rejects an expired verification code', async () => {
    patientRepo.findOne.mockResolvedValue({
      id: USER_ID,
      type: 'patient',
      verificationCode: VALID_CODE,
      verificationCodeExpiry: new Date(Date.now() - 1000),
    });
    await expect(service.deleteAccount(USER_ID, 'patient', VALID_CODE)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('hard-deletes all patient-scoped data and the patient (no dependents)', async () => {
    const res = await service.deleteAccount(USER_ID, 'patient', VALID_CODE);

    // `recordRetained: false` is the meaningful part here: this patient has
    // no clinical document, so the account is genuinely erased rather than
    // anonymised-and-kept (see medical-record-retention.service.ts).
    expect(res).toEqual({
      message: 'Account deleted successfully',
      recordRetained: false,
    });
    expect(committed).toBe(true);
    expect(rolledBack).toBe(false);

    const tables = deletedTables();
    // Every patient sub-resource + orphan-prone tables must be cleared.
    for (const t of [
      'appointments',
      'medications',
      'exams',
      'exam_schedule_items',
      'exam_schedules',
      'patient_surgeries',
      'patient_diseases',
      'patient_allergies',
      'patient_vaccines',
      'patient_access_logs',
      'doctor_access_requests',
      'doctor_permissions',
      'dependent_responsibles',
      'dependent_responsible_invites',
      'notifications',
      'device_tokens',
      'patients',
    ]) {
      expect(tables).toContain(t);
    }

    // The patient row is the last thing deleted.
    expect(tables[tables.length - 1]).toBe('patients');
    // Audit recorded inside the transaction.
    expect(recordDelete).toHaveBeenCalled();
  });

  it('deletes an admin dependent and its data along with the account', async () => {
    selectResponses.adminDependents = [{ dependentId: 'dep-1' }];
    // The user is the SOLE admin of dep-1, so it gets fully deleted.
    selectResponses.dependentAdminsById = { 'dep-1': [{ patientId: USER_ID }] };

    await service.deleteAccount(USER_ID, 'patient', VALID_CODE);

    // Dependent-scoped deletes use dependentId for appointments/etc.
    const depScoped = queries.filter((q) => q.params?.[0] === 'dep-1');
    const depTables = depScoped
      .filter((q) => q.sql.startsWith('DELETE'))
      .map((q) => q.sql.match(/DELETE FROM `(\w+)`/)?.[1]);
    expect(depTables).toContain('appointments');
    expect(depTables).toContain('patient_surgeries');
    expect(depTables).toContain('dependents');
  });

  it('cleans up stored files only after commit', async () => {
    selectResponses.patientProfile = [{ profileImage: 'https://x/bucket/profiles/me.png' }];
    selectResponses.examResultsById = {
      [USER_ID]: [
        {
          resultFile: 'https://x/bucket/exams/a.pdf',
          resultFiles: ['https://x/bucket/exams/b.pdf'],
        },
      ],
    };

    await service.deleteAccount(USER_ID, 'patient', VALID_CODE);

    expect(committed).toBe(true);
    expect(deleteFile).toHaveBeenCalledWith('https://x/bucket/profiles/me.png');
    expect(deleteFile).toHaveBeenCalledWith('https://x/bucket/exams/a.pdf');
    expect(deleteFile).toHaveBeenCalledWith('https://x/bucket/exams/b.pdf');
  });

  it('does not delete files if the transaction fails (rollback)', async () => {
    selectResponses.patientProfile = [{ profileImage: 'https://x/bucket/profiles/me.png' }];
    // Make the audit step throw so the transaction rolls back.
    recordDelete.mockRejectedValue(new Error('boom'));

    await expect(service.deleteAccount(USER_ID, 'patient', VALID_CODE)).rejects.toThrow('boom');

    expect(rolledBack).toBe(true);
    expect(deleteFile).not.toHaveBeenCalled();
  });
  // ── Medical-record retention (audit finding R3) ──────────────────────────
  // CFM Res. 1.821/2007 requires keeping the record for 20 years; LGPD
  // art. 16 allows retaining data to meet a legal obligation. So an account
  // that produced clinical documents is anonymised and kept, not erased —
  // and one that didn't is still genuinely erased. Both branches matter:
  // erasing a record breaches the CFM, keeping an account that could go
  // breaches the LGPD right to erasure.
  describe('medical-record retention', () => {
    it('anonymises instead of deleting when the patient has a record', async () => {
      selectResponses.medicalRecordByIdAndTable = { [USER_ID]: ['prescriptions'] };
      selectResponses.lastEntryByTable = { prescriptions: new Date('2024-02-15T10:00:00Z') };

      const res = await service.deleteAccount(USER_ID, 'patient', VALID_CODE);

      expect(res.recordRetained).toBe(true);
      // The row must NOT be deleted...
      const deletedPatient = queries.some((q) =>
        q.sql.includes('DELETE FROM `patients`'),
      );
      expect(deletedPatient).toBe(false);
      // ...it must be anonymised and stamped instead.
      const update = queries.find((q) => q.sql.includes('UPDATE `patients` SET'));
      expect(update).toBeDefined();
      expect(update!.sql).toContain('`deletedAt` = NOW(6)');
      expect(update!.sql).toContain('`email` = NULL');
      expect(update!.sql).toContain('`password` = NULL');
    });

    it('keeps name and CPF on the retained row', async () => {
      // Without them the retained record no longer identifies its subject,
      // which defeats the very duty being honoured.
      selectResponses.medicalRecordByIdAndTable = { [USER_ID]: ['reports'] };

      await service.deleteAccount(USER_ID, 'patient', VALID_CODE);

      const update = queries.find((q) => q.sql.includes('UPDATE `patients` SET'));
      expect(update!.sql).not.toContain('`name` = NULL');
      expect(update!.sql).not.toContain('`cpf` = NULL');
    });

    it('computes retentionUntil as the last entry + 20 years', async () => {
      selectResponses.medicalRecordByIdAndTable = { [USER_ID]: ['reports'] };
      selectResponses.lastEntryByTable = { reports: new Date('2024-02-15T10:00:00Z') };

      await service.deleteAccount(USER_ID, 'patient', VALID_CODE);

      const update = queries.find((q) => q.sql.includes('UPDATE `patients` SET'));
      expect(update!.params[0]).toBe('2044-02-15');
    });

    it('still erases scheduling data when retaining the record', async () => {
      // Retention covers issued documents, not appointments/medications/
      // exams — those are erased either way.
      selectResponses.medicalRecordByIdAndTable = { [USER_ID]: ['certificates'] };

      await service.deleteAccount(USER_ID, 'patient', VALID_CODE);

      const sql = queries.map((q) => q.sql).join(' ');
      expect(sql).toContain('DELETE FROM `appointments`');
      expect(sql).toContain('DELETE FROM `medications`');
      expect(sql).toContain('DELETE FROM `patient_allergies`');
    });

    it('records the retention in the audit trail', async () => {
      selectResponses.medicalRecordByIdAndTable = { [USER_ID]: ['prescriptions'] };

      await service.deleteAccount(USER_ID, 'patient', VALID_CODE);

      expect(recordDelete).toHaveBeenCalledWith(
        expect.anything(),
        USER_ID,
        expect.objectContaining({ reason: 'ACCOUNT_DELETION_REQUESTED_RECORD_RETAINED' }),
      );
    });

    it('tells the user their clinical record was kept, and why', async () => {
      // Transparency: they asked for erasure, so a blanket "deleted
      // successfully" would not be the whole truth.
      selectResponses.medicalRecordByIdAndTable = { [USER_ID]: ['prescriptions'] };

      const res = await service.deleteAccount(USER_ID, 'patient', VALID_CODE);

      expect(res.message).toContain('20 anos');
      expect(res.message).toContain('CFM 1.821/2007');
    });

    it('blocks deletion when a sole-guardian dependent has a record', async () => {
      // Deleting would breach the CFM duty; keeping an orphan dependent
      // would leave a minor's health data with no responsible party. So the
      // user is asked to hand over responsibility first.
      selectResponses.adminDependents = [{ dependentId: 'dep-1' }];
      selectResponses.dependentAdminsById = { 'dep-1': [{ patientId: USER_ID }] };
      selectResponses.medicalRecordByIdAndTable = { 'dep-1': ['prescriptions'] };

      await expect(
        service.deleteAccount(USER_ID, 'patient', VALID_CODE),
      ).rejects.toThrow(/dependente/i);

      expect(rolledBack).toBe(true);
      expect(deleteFile).not.toHaveBeenCalled();
    });

    it('allows deletion when the dependent has no record', async () => {
      selectResponses.adminDependents = [{ dependentId: 'dep-1' }];
      selectResponses.dependentAdminsById = { 'dep-1': [{ patientId: USER_ID }] };
      selectResponses.medicalRecordByIdAndTable = {}; // nothing anywhere

      const res = await service.deleteAccount(USER_ID, 'patient', VALID_CODE);

      expect(res.recordRetained).toBe(false);
      expect(committed).toBe(true);
      const sql = queries.map((q) => q.sql).join(' ');
      expect(sql).toContain('DELETE FROM `dependents`');
    });

    it('does not block when another guardian remains', async () => {
      // The dependent is simply unlinked from this user, so the minor keeps
      // a responsible party and the record keeps its owner.
      selectResponses.adminDependents = [{ dependentId: 'dep-1' }];
      selectResponses.dependentAdminsById = {
        'dep-1': [{ patientId: USER_ID }, { patientId: 'other-admin' }],
      };
      selectResponses.medicalRecordByIdAndTable = { 'dep-1': ['prescriptions'] };

      const res = await service.deleteAccount(USER_ID, 'patient', VALID_CODE);

      expect(committed).toBe(true);
      expect(res.recordRetained).toBe(false);
      const sql = queries.map((q) => q.sql).join(' ');
      expect(sql).not.toContain('DELETE FROM `dependents`');
    });
  });
});
