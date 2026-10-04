import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { Patient } from '../entities/patient.entity';
import { Doctor } from '../entities/doctor.entity';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { ClinicAdminProfile } from '../entities/clinic-admin-profile.entity';
import { Secretary } from '../entities/secretary.entity';
import { DoctorPermission } from '../entities/doctor-permission.entity';
import { DoctorDocument } from '../entities/doctor-document.entity';
import { UploadService } from '../upload/upload.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DeletionRequestType } from './dto/request-data-deletion.dto';
import { AuditAction } from '../audit/audit.constants';

/**
 * The public deletion-request endpoint backs the URL submitted in Google
 * Play's Data Safety section, so it is reachable by anyone, unauthenticated.
 *
 * The property that matters most here: the response must be identical whether
 * or not an account exists for the submitted email. Leaking that would turn
 * the form into an account-enumeration oracle for a health app — i.e. a way
 * to find out who is a patient.
 */
describe('AuthService - public data deletion request', () => {
  let service: AuthService;
  let patientRepo: { findOne: jest.Mock };
  let doctorRepo: { findOne: jest.Mock };
  let recordSecurityEvent: jest.Mock;
  let sendDeletionRequestReceipt: jest.Mock;

  const basePayload = {
    fullName: 'Maria Silva',
    email: 'maria.silva@email.com',
    requestType: DeletionRequestType.ACCOUNT_AND_DATA,
  };

  beforeEach(async () => {
    patientRepo = { findOne: jest.fn().mockResolvedValue(null) };
    doctorRepo = { findOne: jest.fn().mockResolvedValue(null) };
    recordSecurityEvent = jest.fn().mockResolvedValue(undefined);
    sendDeletionRequestReceipt = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: getRepositoryToken(Doctor), useValue: doctorRepo },
        { provide: getRepositoryToken(ClinicMembership), useValue: {} },
        { provide: getRepositoryToken(ClinicAdminProfile), useValue: {} },
        { provide: getRepositoryToken(Secretary), useValue: {} },
        { provide: getRepositoryToken(DoctorPermission), useValue: {} },
        { provide: getRepositoryToken(DoctorDocument), useValue: {} },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: UploadService, useValue: {} },
        { provide: EmailService, useValue: { sendDeletionRequestReceipt } },
        { provide: AuditService, useValue: { recordSecurityEvent } },
        { provide: NotificationsService, useValue: {} },
        { provide: DataSource, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'privacidade@hispora.com.br') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('returns a protocol and a confirmation message', async () => {
    const result = await service.requestDataDeletion(basePayload);

    expect(result.protocol).toMatch(/^HIS-\d{8}-[A-Z0-9]{6}$/);
    expect(result.message).toContain('15 dias');
  });

  it('responds identically whether or not an account exists', async () => {
    const whenMissing = await service.requestDataDeletion(basePayload);

    patientRepo.findOne.mockResolvedValue({ id: 'patient-1' });
    const whenFound = await service.requestDataDeletion(basePayload);

    // Protocols differ (they're unique), but nothing else may — otherwise the
    // form reveals whether the email has an account.
    expect(Object.keys(whenFound).sort()).toEqual(Object.keys(whenMissing).sort());
    expect(whenFound.message).toBe(whenMissing.message);
    expect(JSON.stringify(whenFound)).not.toMatch(/patient-1/);
  });

  it('records the request in the audit trail, tagged as a public request', async () => {
    patientRepo.findOne.mockResolvedValue({ id: 'patient-1' });

    await service.requestDataDeletion({
      ...basePayload,
      phone: '(11) 99999-0000',
      reason: 'Não utilizo mais o aplicativo',
    });

    expect(recordSecurityEvent).toHaveBeenCalledWith(
      AuditAction.CONSENT_REVOKED,
      expect.objectContaining({
        resourceId: 'patient-1',
        reason: 'PUBLIC_DELETION_REQUEST',
        metadata: expect.objectContaining({
          email: 'maria.silva@email.com',
          requestType: DeletionRequestType.ACCOUNT_AND_DATA,
          accountFound: true,
        }),
      }),
    );
  });

  it('still audits when no account matches, flagging accountFound=false', async () => {
    await service.requestDataDeletion(basePayload);

    expect(recordSecurityEvent).toHaveBeenCalledWith(
      AuditAction.CONSENT_REVOKED,
      expect.objectContaining({
        metadata: expect.objectContaining({ accountFound: false }),
      }),
    );
  });

  it('normalizes the email to lowercase before matching and auditing', async () => {
    await service.requestDataDeletion({
      ...basePayload,
      email: '  MARIA.Silva@Email.com  ',
    });

    expect(patientRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'maria.silva@email.com' } }),
    );
  });

  it('emails a receipt to the requester and the privacy inbox', async () => {
    await service.requestDataDeletion(basePayload);

    expect(sendDeletionRequestReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'maria.silva@email.com',
        privacyInbox: 'privacidade@hispora.com.br',
        requestTypeLabel: 'exclusão de conta e dados',
      }),
    );
  });

  it('labels a data-only request distinctly', async () => {
    await service.requestDataDeletion({
      ...basePayload,
      requestType: DeletionRequestType.DATA_ONLY,
    });

    expect(sendDeletionRequestReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        requestTypeLabel: 'exclusão de dados (mantendo a conta)',
      }),
    );
  });

  it('does not delete anything — it only records the request', async () => {
    const deleteSpy = jest.spyOn(service, 'deleteAccount');

    await service.requestDataDeletion(basePayload);

    // A public endpoint can't prove who the requester is, so the actual
    // deletion stays behind the authenticated, email-confirmed flow.
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('issues a unique protocol per request', async () => {
    const results = await Promise.all([
      service.requestDataDeletion(basePayload),
      service.requestDataDeletion(basePayload),
      service.requestDataDeletion(basePayload),
    ]);

    const protocols = new Set(results.map((r) => r.protocol));
    expect(protocols.size).toBe(3);
  });
});
