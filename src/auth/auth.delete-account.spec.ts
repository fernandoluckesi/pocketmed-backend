import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { Patient } from '../entities/patient.entity';
import { Doctor } from '../entities/doctor.entity';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { ClinicAdminProfile } from '../entities/clinic-admin-profile.entity';
import { Secretary } from '../entities/secretary.entity';
import { UploadService } from '../upload/upload.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';

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
    adminDependents?: { id: string }[];
    examResultsById?: Record<string, { resultFile: string | null; resultFiles: any }[]>;
    dependentProfileById?: Record<string, { profileImage: string | null }[]>;
    patientProfile?: { profileImage: string | null }[];
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

        if (sql.includes('SELECT `id` FROM `dependents` WHERE `adminResponsibleId`')) {
          return Promise.resolve(selectResponses.adminDependents ?? []);
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
        { provide: getRepositoryToken(ClinicMembership), useValue: {} },
        { provide: getRepositoryToken(ClinicAdminProfile), useValue: {} },
        { provide: getRepositoryToken(Secretary), useValue: {} },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: UploadService, useValue: { deleteFile } },
        { provide: EmailService, useValue: { sendAccountDeletionCode: jest.fn() } },
        { provide: AuditService, useValue: { recordDelete } },
        { provide: DataSource, useValue: dataSource },
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

    expect(res).toEqual({ message: 'Account deleted successfully' });
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
    selectResponses.adminDependents = [{ id: 'dep-1' }];

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
});
