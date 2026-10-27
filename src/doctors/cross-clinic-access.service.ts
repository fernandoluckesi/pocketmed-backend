import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, Or, IsNull, MoreThan } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { Doctor } from '../entities/doctor.entity';
import { Clinic } from '../entities/clinic.entity';
import {
  DoctorAccessRequest,
  AccessRequestStatus,
  AccessRequestChannel,
} from '../entities/doctor-access-request.entity';
import { DoctorPermission } from '../entities/doctor-permission.entity';
import { DoctorsService } from './doctors.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditResourceType } from '../audit/audit.constants';
import { CrossClinicConsentTokenService } from './cross-clinic-consent-token.service';
import { normalizeCpf } from '../common/validators/cpf.util';

/** Bump when the consent copy materially changes — stored on each request row. */
const CONSENT_TEXT_VERSION = 'v1';
const CONSENT_TOKEN_TTL_MINUTES = 15;

export interface PatientLookupResult {
  found: boolean;
  /** Only meaningful when `found` is true. */
  alreadyAccessible?: boolean;
  patientId?: string;
  name?: string;
}

export interface ConsentDetails {
  doctorName: string;
  clinicName: string;
  purpose: string;
  patientName: string;
  requiresCpfConfirmation: boolean;
  expiresAt: Date | null;
  accessWindowMinutes: number;
}

/**
 * Cross-clinic patient-record-sharing authorization (patient Shadow flow).
 *
 * Deliberately composes with the existing `DoctorAccessRequest`/
 * `DoctorPermission` pair (see `DoctorsService`) instead of introducing a
 * parallel request/grant model — the only new concepts are (a) *how* a
 * shadow patient (no app account) confirms, via a single-use emailed link
 * instead of an in-app response, and (b) that the resulting `DoctorPermission`
 * can carry an expiry instead of being permanent. `PatientsService.findOne`
 * (the one checkpoint every patient sub-resource route already calls)
 * already enforces that expiry — see the permission queries there.
 */
@Injectable()
export class CrossClinicAccessService {
  private readonly logger = new Logger(CrossClinicAccessService.name);
  private readonly webUrl: string;
  private readonly accessWindowMinutes: number;

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    @InjectRepository(DoctorAccessRequest)
    private readonly accessRequestRepository: Repository<DoctorAccessRequest>,
    @InjectRepository(DoctorPermission)
    private readonly permissionRepository: Repository<DoctorPermission>,
    private readonly doctorsService: DoctorsService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    private readonly tokenService: CrossClinicConsentTokenService,
    private readonly configService: ConfigService,
  ) {
    this.webUrl = (
      this.configService.get<string>('WEB_URL') || 'http://localhost:5173'
    ).replace(/\/+$/, '');
    this.accessWindowMinutes =
      Number(this.configService.get<string>('CROSS_CLINIC_ACCESS_WINDOW_MINUTES')) || 120;
  }

  /**
   * Read-only existence check — deliberately NOT reusing `/auth/check-shadow`
   * (public, mutates by sending an email, and is a textbook enumeration
   * oracle). This one is doctor-authenticated and reveals nothing beyond
   * "found, here's the name" for a patient the doctor doesn't already have
   * access to — never clinical data, never which clinic owns the record.
   *
   * `alreadyAccessible` distinguishes "this doctor already has access"
   * (creator, or an active permission) from "genuinely no record" — both
   * used to collapse to `found: false`, which let the frontend route an
   * already-accessible SHADOW patient into the full registration form (the
   * backend's duplicate-email guard only fires for non-shadow patients),
   * silently creating a duplicate shadow record instead of just telling the
   * doctor they already have access. Revealing this to the requesting
   * doctor isn't an enumeration risk — they already have access to this
   * exact record elsewhere in the app.
   */
  async lookupByEmail(doctorId: string, email: string): Promise<PatientLookupResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const patient = await this.patientRepository.findOne({ where: { email: normalizedEmail } });

    if (!patient) return { found: false };

    if (patient.doctorCreatorId === doctorId) {
      return { found: true, alreadyAccessible: true, patientId: patient.id, name: patient.name };
    }

    const existingPermission = await this.permissionRepository.findOne({
      where: {
        doctorId,
        patientId: patient.id,
        isActive: true,
        expiresAt: Or(IsNull(), MoreThan(new Date())),
      },
    });
    if (existingPermission) {
      return { found: true, alreadyAccessible: true, patientId: patient.id, name: patient.name };
    }

    return { found: true, alreadyAccessible: false, patientId: patient.id, name: patient.name };
  }

  async requestCrossClinicAccess(
    doctorId: string,
    activeClinicId: string | null,
    patientId: string,
    purpose: string,
  ) {
    const patient = await this.patientRepository.findOne({ where: { id: patientId } });
    if (!patient) {
      throw new NotFoundException('Paciente não encontrado.');
    }

    if (patient.doctorCreatorId === doctorId) {
      throw new BadRequestException('Você já tem acesso a este paciente.');
    }

    const existingPending = await this.accessRequestRepository.findOne({
      where: { doctorId, patientId, status: AccessRequestStatus.PENDING },
    });
    if (existingPending) {
      throw new BadRequestException('Já existe uma solicitação pendente para este paciente.');
    }

    if (!patient.isShadow) {
      // Patient has a real app account: reuse the existing in-app
      // request/response flow untouched (notification + patient-side
      // approval already handles this correctly, including on mobile).
      return this.doctorsService.requestAccess(doctorId, {
        patientId,
        message: purpose,
        requestingClinicId: activeClinicId ?? undefined,
        purpose,
      });
    }

    const doctor = await this.doctorRepository.findOne({ where: { id: doctorId } });
    const clinic = activeClinicId
      ? await this.clinicRepository.findOne({ where: { id: activeClinicId } })
      : null;

    const { token, hash } = this.tokenService.generate();
    const consentTokenExpiresAt = new Date(Date.now() + CONSENT_TOKEN_TTL_MINUTES * 60_000);

    const request = this.accessRequestRepository.create({
      doctorId,
      patientId,
      status: AccessRequestStatus.PENDING,
      message: purpose,
      requestingClinicId: activeClinicId ?? null,
      purpose,
      channel: AccessRequestChannel.EMAIL_LINK,
      consentTokenHash: hash,
      consentTokenExpiresAt,
      consentTextVersion: CONSENT_TEXT_VERSION,
      linkSentAt: new Date(),
    });
    const saved = await this.accessRequestRepository.save(request);

    const actionUrl = `${this.webUrl}/acesso-prontuario/${saved.id}?token=${token}`;
    const emailStatus = await this.emailService.sendCrossClinicAuthorizationRequest(patient.email, {
      patientName: patient.name,
      doctorName: doctor?.name ?? 'Médico',
      clinicName: clinic?.name ?? 'outra clínica',
      purpose,
      expiresInMinutes: CONSENT_TOKEN_TTL_MINUTES,
      actionUrl,
    });

    await this.auditService.recordSecurityEvent(AuditAction.CREATE, {
      resourceType: AuditResourceType.CONSENT,
      resourceId: saved.id,
      patientId,
      success: emailStatus === 'sent',
      metadata: {
        doctorId,
        requestingClinicId: activeClinicId,
        channel: AccessRequestChannel.EMAIL_LINK,
        emailStatus,
      },
    });

    return {
      id: saved.id,
      status: saved.status,
      channel: saved.channel,
      emailStatus,
    };
  }

  /**
   * Resends the authorization e-mail for a still-pending EMAIL_LINK request —
   * rotates the token (old one stops working) rather than re-sending the same
   * link, so a resend never leaves two simultaneously-valid links around.
   * Only the requesting doctor can trigger this.
   */
  async resendConsentLink(
    doctorId: string,
    requestId: string,
  ): Promise<{ emailStatus: 'sent' | 'failed' }> {
    const request = await this.accessRequestRepository.findOne({ where: { id: requestId } });
    if (!request || request.doctorId !== doctorId) {
      throw new NotFoundException('Solicitação não encontrada.');
    }
    if (request.channel !== AccessRequestChannel.EMAIL_LINK) {
      throw new BadRequestException('Esta solicitação não usa envio por link.');
    }
    if (request.status !== AccessRequestStatus.PENDING) {
      throw new BadRequestException('Esta solicitação não está mais pendente.');
    }

    const patient = await this.patientRepository.findOne({ where: { id: request.patientId! } });
    if (!patient) {
      throw new NotFoundException('Paciente não encontrado.');
    }

    const doctor = await this.doctorRepository.findOne({ where: { id: doctorId } });
    const clinic = request.requestingClinicId
      ? await this.clinicRepository.findOne({ where: { id: request.requestingClinicId } })
      : null;

    const { token, hash } = this.tokenService.generate();
    request.consentTokenHash = hash;
    request.consentTokenExpiresAt = new Date(Date.now() + CONSENT_TOKEN_TTL_MINUTES * 60_000);
    request.linkSentAt = new Date();
    await this.accessRequestRepository.save(request);

    const actionUrl = `${this.webUrl}/acesso-prontuario/${request.id}?token=${token}`;
    const emailStatus = await this.emailService.sendCrossClinicAuthorizationRequest(
      patient.email,
      {
        patientName: patient.name,
        doctorName: doctor?.name ?? 'Médico',
        clinicName: clinic?.name ?? 'outra clínica',
        purpose: request.purpose ?? 'Atendimento médico',
        expiresInMinutes: CONSENT_TOKEN_TTL_MINUTES,
        actionUrl,
      },
    );

    await this.auditService.recordSecurityEvent(AuditAction.CREATE, {
      resourceType: AuditResourceType.CONSENT,
      resourceId: request.id,
      patientId: request.patientId ?? undefined,
      success: emailStatus === 'sent',
      metadata: { doctorId, channel: AccessRequestChannel.EMAIL_LINK, emailStatus, resend: true },
    });

    return { emailStatus };
  }

  /**
   * Returns only what's needed to render the consent page. Deliberately
   * does NOT consume the token — opening the link must never count as
   * authorization, and link-preview crawlers must not be able to burn it.
   */
  async getConsentDetails(requestId: string, token: string): Promise<ConsentDetails> {
    const request = await this.findValidPendingRequestOrThrow(requestId, token);
    const doctor = await this.doctorRepository.findOne({ where: { id: request.doctorId } });
    const clinic = request.requestingClinicId
      ? await this.clinicRepository.findOne({ where: { id: request.requestingClinicId } })
      : null;
    const patient = await this.patientRepository.findOne({ where: { id: request.patientId! } });

    return {
      doctorName: doctor?.name ?? 'Médico',
      clinicName: clinic?.name ?? 'outra clínica',
      purpose: request.purpose ?? 'Atendimento médico',
      patientName: patient?.name ?? '',
      requiresCpfConfirmation: !!patient?.cpf,
      expiresAt: request.consentTokenExpiresAt,
      accessWindowMinutes: this.accessWindowMinutes,
    };
  }

  async respondToConsent(
    requestId: string,
    token: string,
    decision: 'AUTHORIZE' | 'DENY',
    cpfLast4?: string,
  ): Promise<{ decision: 'AUTHORIZE' | 'DENY' }> {
    const request = await this.findValidPendingRequestOrThrow(requestId, token);
    const patient = await this.patientRepository.findOne({ where: { id: request.patientId! } });

    if (decision === 'AUTHORIZE' && patient?.cpf) {
      const actualLast4 = normalizeCpf(patient.cpf).slice(-4);
      if (!cpfLast4 || cpfLast4 !== actualLast4) {
        throw new BadRequestException('Não foi possível confirmar sua identidade.');
      }
    }

    const nextStatus =
      decision === 'AUTHORIZE' ? AccessRequestStatus.APPROVED : AccessRequestStatus.REJECTED;

    // Atomic claim — only succeeds while the row is still PENDING, unexpired,
    // and matches this exact token hash. Guards concurrent double-submission
    // of the same link: a second request (even truly simultaneous) affects
    // zero rows because the first one already flipped the status.
    const updateResult = await this.accessRequestRepository
      .createQueryBuilder()
      .update(DoctorAccessRequest)
      .set({ status: nextStatus })
      .where('id = :id', { id: requestId })
      .andWhere('status = :pending', { pending: AccessRequestStatus.PENDING })
      .andWhere('consentTokenHash = :hash', { hash: this.tokenService.hash(token) })
      .andWhere('consentTokenExpiresAt > :now', { now: new Date() })
      .execute();

    if (!updateResult.affected) {
      throw new NotFoundException('Link inválido ou expirado.');
    }

    if (decision === 'AUTHORIZE') {
      const permission = this.permissionRepository.create({
        doctorId: request.doctorId,
        patientId: request.patientId,
        isActive: true,
        expiresAt: new Date(Date.now() + this.accessWindowMinutes * 60_000),
        sourceRequestId: request.id,
      });
      await this.permissionRepository.save(permission);
    }

    await this.auditService.recordSecurityEvent(
      decision === 'AUTHORIZE' ? AuditAction.CONSENT_GRANTED : AuditAction.CONSENT_REVOKED,
      {
        resourceType: AuditResourceType.CONSENT,
        resourceId: request.id,
        patientId: request.patientId ?? undefined,
        success: true,
        metadata: { doctorId: request.doctorId, decision },
      },
    );

    this.doctorsService.notifyAccessRequestOutcome(
      request.doctorId,
      nextStatus,
      request.id,
      request.patientId,
    );

    return { decision };
  }

  private async findValidPendingRequestOrThrow(
    requestId: string,
    token: string,
  ): Promise<DoctorAccessRequest> {
    const request = await this.accessRequestRepository.findOne({ where: { id: requestId } });
    const hash = this.tokenService.hash(token);
    const isValid =
      !!request &&
      request.channel === AccessRequestChannel.EMAIL_LINK &&
      request.status === AccessRequestStatus.PENDING &&
      request.consentTokenHash === hash &&
      !!request.consentTokenExpiresAt &&
      request.consentTokenExpiresAt.getTime() > Date.now();

    if (!isValid) {
      // Same discipline as document-access.controller.ts: one generic
      // message for bad/expired/consumed/wrong-request-id token, never
      // distinguishing which — an attacker probing tokens learns nothing.
      await this.auditService.recordSecurityEvent(AuditAction.ACCESS_DENIED, {
        resourceType: AuditResourceType.CONSENT,
        resourceId: requestId,
        success: false,
        reason: 'INVALID_OR_EXPIRED_TOKEN',
      });
      throw new NotFoundException('Link inválido ou expirado.');
    }

    return request as DoctorAccessRequest;
  }
}
