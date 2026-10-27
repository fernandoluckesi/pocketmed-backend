import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { CrossClinicAccessService } from './cross-clinic-access.service';
import { CrossClinicConsentTokenService } from './cross-clinic-consent-token.service';
import { DoctorsService } from './doctors.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { Patient } from '../entities/patient.entity';
import { Doctor } from '../entities/doctor.entity';
import { Clinic } from '../entities/clinic.entity';
import { DoctorAccessRequest, AccessRequestStatus } from '../entities/doctor-access-request.entity';
import { DoctorPermission } from '../entities/doctor-permission.entity';

/**
 * Covers the core security properties of the cross-clinic consent flow:
 * single-use tokens, expiry, non-enumeration of the lookup endpoint, and
 * that a denied/invalid request never grants access. Not an exhaustive
 * scenario matrix — see the plan's explicitly-scoped-down test section.
 */
describe('CrossClinicAccessService', () => {
  let service: CrossClinicAccessService;
  let patientRepo: { findOne: jest.Mock };
  let doctorRepo: { findOne: jest.Mock };
  let clinicRepo: { findOne: jest.Mock };
  let accessRequestRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let permissionRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let doctorsService: { requestAccess: jest.Mock; notifyAccessRequestOutcome: jest.Mock };
  let emailService: { sendCrossClinicAuthorizationRequest: jest.Mock };
  let auditService: { recordSecurityEvent: jest.Mock };

  /** Shared mutable "row" so the mocked update-builder can flip its status,
   * modeling the real atomic UPDATE...WHERE status='PENDING' behavior. */
  let requestRow: Partial<DoctorAccessRequest> & { id: string };

  function buildUpdateQueryBuilder() {
    const qb: any = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn((patch: Partial<DoctorAccessRequest>) => {
        qb._patch = patch;
        return qb;
      }),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(async () => {
        // Mirrors `WHERE status = 'pending' AND consentTokenHash = :hash AND
        // consentTokenExpiresAt > :now` — only "affects" the row if it's
        // still in the state the real SQL would require.
        const stillPending = requestRow.status === AccessRequestStatus.PENDING;
        const notExpired =
          !!requestRow.consentTokenExpiresAt &&
          (requestRow.consentTokenExpiresAt as Date).getTime() > Date.now();
        if (stillPending && notExpired) {
          requestRow.status = qb._patch.status;
          return { affected: 1 };
        }
        return { affected: 0 };
      }),
    };
    return qb;
  }

  const tokenService = new CrossClinicConsentTokenService();

  beforeEach(async () => {
    requestRow = {
      id: 'req-1',
      doctorId: 'doctor-1',
      patientId: 'patient-1',
      status: AccessRequestStatus.PENDING,
      channel: 'email_link' as any,
      consentTokenHash: tokenService.hash('good-token'),
      consentTokenExpiresAt: new Date(Date.now() + 15 * 60_000),
      purpose: 'Preparação de consulta',
      requestingClinicId: 'clinic-b',
    };

    patientRepo = { findOne: jest.fn() };
    doctorRepo = { findOne: jest.fn().mockResolvedValue({ id: 'doctor-1', name: 'Dr. Teste' }) };
    clinicRepo = { findOne: jest.fn().mockResolvedValue({ id: 'clinic-b', name: 'Clínica B' }) };
    accessRequestRepo = {
      findOne: jest.fn(async () => ({ ...requestRow })),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'req-1', ...x })),
      createQueryBuilder: jest.fn(() => buildUpdateQueryBuilder()),
    };
    permissionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    doctorsService = {
      requestAccess: jest.fn().mockResolvedValue({ id: 'in-app-req' }),
      notifyAccessRequestOutcome: jest.fn(),
    };
    emailService = { sendCrossClinicAuthorizationRequest: jest.fn().mockResolvedValue('sent') };
    auditService = { recordSecurityEvent: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrossClinicAccessService,
        CrossClinicConsentTokenService,
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: getRepositoryToken(Doctor), useValue: doctorRepo },
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: getRepositoryToken(DoctorAccessRequest), useValue: accessRequestRepo },
        { provide: getRepositoryToken(DoctorPermission), useValue: permissionRepo },
        { provide: DoctorsService, useValue: doctorsService },
        { provide: EmailService, useValue: emailService },
        { provide: AuditService, useValue: auditService },
        { provide: ConfigService, useValue: { get: jest.fn(() => undefined) } },
      ],
    }).compile();

    service = module.get(CrossClinicAccessService);
  });

  describe('lookupByEmail', () => {
    it('reveals only found + name, never clinical data', async () => {
      patientRepo.findOne.mockResolvedValue({
        id: 'patient-1',
        name: 'Ana Maria',
        doctorCreatorId: 'other-doctor',
        email: 'ana@example.com',
      });

      const result = await service.lookupByEmail('doctor-1', 'ANA@example.com');

      expect(result).toEqual({
        found: true,
        alreadyAccessible: false,
        patientId: 'patient-1',
        name: 'Ana Maria',
      });
      expect(Object.keys(result).sort()).toEqual(
        ['found', 'alreadyAccessible', 'name', 'patientId'].sort(),
      );
    });

    it('returns not-found when no patient matches', async () => {
      patientRepo.findOne.mockResolvedValue(null);
      await expect(service.lookupByEmail('doctor-1', 'nobody@example.com')).resolves.toEqual({
        found: false,
      });
    });

    it('flags the patient as already-accessible when the doctor already created them — distinct from not-found, so the frontend never routes an existing patient back into the duplicate-creation form', async () => {
      patientRepo.findOne.mockResolvedValue({
        id: 'patient-1',
        name: 'Ana Maria',
        doctorCreatorId: 'doctor-1',
      });
      await expect(service.lookupByEmail('doctor-1', 'ana@example.com')).resolves.toEqual({
        found: true,
        alreadyAccessible: true,
        patientId: 'patient-1',
        name: 'Ana Maria',
      });
    });

    it('flags the patient as already-accessible when the doctor already has an active, unexpired permission', async () => {
      patientRepo.findOne.mockResolvedValue({
        id: 'patient-1',
        name: 'Ana Maria',
        doctorCreatorId: 'other-doctor',
      });
      permissionRepo.findOne.mockResolvedValue({ id: 'perm-1', isActive: true });
      await expect(service.lookupByEmail('doctor-1', 'ana@example.com')).resolves.toEqual({
        found: true,
        alreadyAccessible: true,
        patientId: 'patient-1',
        name: 'Ana Maria',
      });
    });
  });

  describe('requestCrossClinicAccess', () => {
    it('routes a shadow patient through the email-link channel and sends the email', async () => {
      patientRepo.findOne.mockResolvedValue({
        id: 'patient-1',
        name: 'Ana Maria',
        email: 'ana@example.com',
        isShadow: true,
        doctorCreatorId: 'other-doctor',
      });
      accessRequestRepo.findOne.mockResolvedValueOnce(null); // no pending duplicate

      const result = await service.requestCrossClinicAccess(
        'doctor-1',
        'clinic-b',
        'patient-1',
        'Preparação de consulta',
      );

      expect(emailService.sendCrossClinicAuthorizationRequest).toHaveBeenCalledWith(
        'ana@example.com',
        expect.objectContaining({ patientName: 'Ana Maria', doctorName: 'Dr. Teste' }),
      );
      expect(doctorsService.requestAccess).not.toHaveBeenCalled();
      expect(result.channel).toBe('email_link');
    });

    it('routes a patient with a real account through the existing in-app flow', async () => {
      patientRepo.findOne.mockResolvedValue({
        id: 'patient-1',
        name: 'Ana Maria',
        isShadow: false,
        doctorCreatorId: 'other-doctor',
      });
      accessRequestRepo.findOne.mockResolvedValueOnce(null);

      await service.requestCrossClinicAccess('doctor-1', 'clinic-b', 'patient-1', 'Consulta');

      expect(doctorsService.requestAccess).toHaveBeenCalledWith(
        'doctor-1',
        expect.objectContaining({ patientId: 'patient-1', requestingClinicId: 'clinic-b' }),
      );
      expect(emailService.sendCrossClinicAuthorizationRequest).not.toHaveBeenCalled();
    });

    it('rejects when the doctor already created this patient', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 'patient-1', doctorCreatorId: 'doctor-1' });
      await expect(
        service.requestCrossClinicAccess('doctor-1', 'clinic-b', 'patient-1', 'Consulta'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a second request while one is already pending', async () => {
      patientRepo.findOne.mockResolvedValue({
        id: 'patient-1',
        isShadow: true,
        doctorCreatorId: 'other-doctor',
      });
      accessRequestRepo.findOne.mockResolvedValueOnce({ id: 'existing', status: 'pending' });
      await expect(
        service.requestCrossClinicAccess('doctor-1', 'clinic-b', 'patient-1', 'Consulta'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('resendConsentLink', () => {
    it('rotates the token and resends the e-mail for a still-pending request', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 'patient-1', name: 'Ana Maria', email: 'ana@example.com' });

      const result = await service.resendConsentLink('doctor-1', 'req-1');

      expect(result.emailStatus).toBe('sent');
      expect(emailService.sendCrossClinicAuthorizationRequest).toHaveBeenCalledWith(
        'ana@example.com',
        expect.objectContaining({ patientName: 'Ana Maria' }),
      );
      const savedArg = accessRequestRepo.save.mock.calls[0][0];
      expect(savedArg.consentTokenHash).not.toBe(requestRow.consentTokenHash);
      expect(savedArg.consentTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('rejects when a different doctor tries to resend someone else\'s request', async () => {
      await expect(service.resendConsentLink('doctor-2', 'req-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects when the request is not an email-link channel', async () => {
      requestRow.channel = 'in_app' as any;
      await expect(service.resendConsentLink('doctor-1', 'req-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects when the request is no longer pending', async () => {
      requestRow.status = AccessRequestStatus.APPROVED;
      await expect(service.resendConsentLink('doctor-1', 'req-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('respondToConsent — token single-use and expiry', () => {
    it('authorizes once, grants a time-boxed permission, and audits CONSENT_GRANTED', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 'patient-1', cpf: null });

      const result = await service.respondToConsent('req-1', 'good-token', 'AUTHORIZE');

      expect(result).toEqual({ decision: 'AUTHORIZE' });
      expect(permissionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ doctorId: 'doctor-1', patientId: 'patient-1', isActive: true }),
      );
      const savedPermission = permissionRepo.save.mock.calls[0][0];
      expect(savedPermission.expiresAt).toBeInstanceOf(Date);
      expect(savedPermission.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(auditService.recordSecurityEvent).toHaveBeenCalledWith(
        'CONSENT_GRANTED',
        expect.objectContaining({ resourceId: 'req-1' }),
      );
    });

    it('rejects a second confirmation attempt with the same token (single-use)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 'patient-1', cpf: null });

      await service.respondToConsent('req-1', 'good-token', 'AUTHORIZE');
      permissionRepo.save.mockClear();

      await expect(
        service.respondToConsent('req-1', 'good-token', 'AUTHORIZE'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(permissionRepo.save).not.toHaveBeenCalled();
    });

    it('rejects an expired token and grants no access', async () => {
      requestRow.consentTokenExpiresAt = new Date(Date.now() - 1000);
      patientRepo.findOne.mockResolvedValue({ id: 'patient-1', cpf: null });

      await expect(
        service.respondToConsent('req-1', 'good-token', 'AUTHORIZE'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(permissionRepo.save).not.toHaveBeenCalled();
    });

    it('rejects the wrong token for a valid request id', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 'patient-1', cpf: null });

      await expect(
        service.respondToConsent('req-1', 'totally-wrong-token', 'AUTHORIZE'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(permissionRepo.save).not.toHaveBeenCalled();
    });

    it('denying never grants a permission', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 'patient-1', cpf: null });

      const result = await service.respondToConsent('req-1', 'good-token', 'DENY');

      expect(result).toEqual({ decision: 'DENY' });
      expect(permissionRepo.save).not.toHaveBeenCalled();
      expect(auditService.recordSecurityEvent).toHaveBeenCalledWith(
        'CONSENT_REVOKED',
        expect.objectContaining({ resourceId: 'req-1' }),
      );
    });

    it('requires the correct CPF last-4 digits to authorize when the record has a CPF', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 'patient-1', cpf: '390.533.447-05' });

      await expect(
        service.respondToConsent('req-1', 'good-token', 'AUTHORIZE', '9999'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(permissionRepo.save).not.toHaveBeenCalled();

      const result = await service.respondToConsent('req-1', 'good-token', 'AUTHORIZE', '4705');
      expect(result).toEqual({ decision: 'AUTHORIZE' });
    });
  });

  describe('respondToConsent — concurrency', () => {
    it('only one of two truly concurrent confirmations succeeds', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 'patient-1', cpf: null });

      // Fired without awaiting either first, so both read the same
      // still-PENDING row before either write lands — exactly the race the
      // atomic `UPDATE ... WHERE status = 'pending'` guards against.
      const [first, second] = await Promise.allSettled([
        service.respondToConsent('req-1', 'good-token', 'AUTHORIZE'),
        service.respondToConsent('req-1', 'good-token', 'AUTHORIZE'),
      ]);

      const outcomes = [first, second];
      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o) => o.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(NotFoundException);
      expect(permissionRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('getConsentDetails', () => {
    it('never consumes the token just by being read', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 'patient-1', name: 'Ana Maria', cpf: null });

      await service.getConsentDetails('req-1', 'good-token');

      expect(requestRow.status).toBe(AccessRequestStatus.PENDING);
      // A subsequent real confirmation must still work after merely viewing the page.
      const result = await service.respondToConsent('req-1', 'good-token', 'AUTHORIZE');
      expect(result).toEqual({ decision: 'AUTHORIZE' });
    });

    it('throws the same generic error for an invalid token as for an expired one', async () => {
      await expect(service.getConsentDetails('req-1', 'bad-token')).rejects.toThrow(
        'Link inválido ou expirado.',
      );
      requestRow.consentTokenExpiresAt = new Date(Date.now() - 1000);
      await expect(service.getConsentDetails('req-1', 'good-token')).rejects.toThrow(
        'Link inválido ou expirado.',
      );
    });
  });
});
