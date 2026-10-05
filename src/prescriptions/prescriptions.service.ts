import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prescription } from '../entities/prescription.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Dependent } from '../entities/dependent.entity';
import { Appointment } from '../entities/appointment.entity';
import { DoctorsService } from '../doctors/doctors.service';
import { DocumentGenerationService } from '../documents/document-generation.service';
import { SignatureService } from '../documents/signature/signature.service';
import { DOCUMENT_FOLDERS, DocumentStatus, MedicalDocumentSpec } from '../documents/document.types';
import { SignatureStatus } from '../documents/signature/signature.types';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditResourceType } from '../audit/audit.constants';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';

@Injectable()
export class PrescriptionsService {
  constructor(
    @InjectRepository(Prescription)
    private prescriptionRepository: Repository<Prescription>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Dependent)
    private dependentRepository: Repository<Dependent>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    private doctorsService: DoctorsService,
    private documentGenerationService: DocumentGenerationService,
    private signatureService: SignatureService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
  ) {}

  async create(doctorId: string, dto: CreatePrescriptionDto) {
    if (!dto.patientId && !dto.dependentId) {
      throw new BadRequestException('Either patientId or dependentId must be provided');
    }
    if (dto.patientId && dto.dependentId) {
      throw new BadRequestException('Provide either patientId or dependentId, not both');
    }

    const hasPermission = await this.doctorsService.hasPermission(
      doctorId,
      dto.patientId,
      dto.dependentId,
    );
    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to create prescriptions for this patient/dependent',
      );
    }

    if (dto.appointmentId) {
      const appointment = await this.appointmentRepository.findOne({
        where: { id: dto.appointmentId },
      });
      const belongsToTarget = dto.patientId
        ? appointment?.patientId === dto.patientId
        : appointment?.dependentId === dto.dependentId;
      if (!appointment || !belongsToTarget) {
        throw new BadRequestException('appointmentId inválido ou não pertence a este paciente');
      }
    }

    const prescription = this.prescriptionRepository.create({
      doctorId,
      patientId: dto.patientId || null,
      dependentId: dto.dependentId || null,
      appointmentId: dto.appointmentId || null,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
      items: dto.items,
      observations: dto.observations || null,
      status: DocumentStatus.DRAFT,
    });

    const saved = await this.prescriptionRepository.save(prescription);

    await this.auditService.recordCreate(AuditResourceType.PRESCRIPTION, saved.id, {
      patientId: saved.patientId || undefined,
      metadata: { doctorId, dependentId: saved.dependentId },
    });

    return saved;
  }

  async findAll(doctorId: string, patientId?: string) {
    return this.prescriptionRepository.find({
      where: {
        doctorId,
        ...(patientId ? { patientId } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string) {
    // No relations loaded here: Doctor/Patient don't mark `password` as
    // `select: false`, so eagerly joining them would leak the bcrypt hash
    // into this response. Callers that need doctor/patient display data
    // fetch it themselves with an explicit column allowlist (see
    // `generatePdf`'s `select` below).
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    if (!(await this.canAccess(prescription, userId))) {
      await this.auditService.recordAccessDenied(AuditResourceType.PRESCRIPTION, {
        resourceId: id,
        patientId: prescription.patientId || undefined,
        reason: 'INSUFFICIENT_PERMISSION',
      });
      throw new ForbiddenException('You do not have permission to view this prescription');
    }

    await this.auditService.recordRead(AuditResourceType.PRESCRIPTION, id, {
      patientId: prescription.patientId || undefined,
    });

    return prescription;
  }

  async update(id: string, userId: string, dto: UpdatePrescriptionDto) {
    const prescription = await this.findOwnedByDoctor(id, userId);

    if (prescription.status === DocumentStatus.SIGNED) {
      throw new ConflictException(
        'This prescription has already been signed and can no longer be edited — generate a new one instead',
      );
    }

    const changedFields: Record<string, { before?: unknown; after?: unknown }> = {};
    for (const key of Object.keys(dto) as (keyof UpdatePrescriptionDto)[]) {
      if (dto[key] !== undefined) {
        changedFields[key] = { before: (prescription as any)[key], after: dto[key] };
      }
    }

    if (dto.items) prescription.items = dto.items;
    if (dto.observations !== undefined) prescription.observations = dto.observations;
    if (dto.issueDate) prescription.issueDate = new Date(dto.issueDate);

    const saved = await this.prescriptionRepository.save(prescription);

    await this.auditService.recordUpdate(AuditResourceType.PRESCRIPTION, id, changedFields, {
      patientId: prescription.patientId || undefined,
    });

    return saved;
  }

  async delete(id: string, userId: string) {
    const prescription = await this.findOwnedByDoctor(id, userId);

    if (prescription.status === DocumentStatus.SIGNED) {
      throw new ConflictException(
        'This prescription has already been signed and cannot be deleted',
      );
    }

    await this.prescriptionRepository.remove(prescription);

    await this.auditService.recordDelete(AuditResourceType.PRESCRIPTION, id, {
      patientId: prescription.patientId || undefined,
      metadata: { doctorId: prescription.doctorId },
    });

    return { message: 'Prescription deleted successfully' };
  }

  async generatePdf(id: string, userId: string) {
    const prescription = await this.findOwnedByDoctor(id, userId);

    if (prescription.status === DocumentStatus.SIGNED) {
      throw new ConflictException('This prescription has already been signed and is immutable');
    }

    const spec = await this.buildSpec(prescription);

    const pdfBuffer = await this.documentGenerationService.renderToBuffer(spec);
    const documentHash = this.documentGenerationService.computeHash(pdfBuffer);

    const signatureResult = await this.signatureService.signDocument({
      pdfBuffer,
      documentHash,
      documentId: prescription.id,
      signerName: spec.doctor.name,
    });

    const documentUrl = await this.documentGenerationService.store(signatureResult.pdfBuffer, {
      folder: DOCUMENT_FOLDERS.prescriptions,
      filenameHint: prescription.id,
    });

    const statusBefore = prescription.status;

    prescription.documentUrl = documentUrl;
    prescription.documentHash = documentHash;
    prescription.signatureStatus = signatureResult.status;
    prescription.signatureProvider = signatureResult.provider;
    prescription.signedAt = signatureResult.signedAt;
    prescription.externalSignatureId = signatureResult.externalSignatureId;
    prescription.status = DocumentStatus.GENERATED;

    const saved = await this.prescriptionRepository.save(prescription);

    await this.auditService.recordUpdate(
      AuditResourceType.PRESCRIPTION,
      id,
      { status: { before: statusBefore, after: saved.status } },
      { patientId: prescription.patientId || undefined, metadata: { documentHash } },
    );

    return saved;
  }

  /** The exact document the PDF renderer is fed. Exposed (read-only) through
   * `GET /prescriptions/:id/preview` so "Visualiza a receita" shows the same
   * spec the PDF is drawn from instead of the frontend rebuilding it. */
  private async buildSpec(prescription: Prescription): Promise<MedicalDocumentSpec> {
    // Explicit column allowlist — Doctor/Patient/Dependent don't mark
    // `password` as `select: false`, so a plain `findOne` would pull the
    // bcrypt hash into memory (and, if ever attached to the response,
    // into the API result). Only ever select what the PDF actually prints.
    const doctor = await this.doctorRepository.findOne({
      where: { id: prescription.doctorId },
      select: ['id', 'name', 'crm', 'specialty'],
    });
    const patientRecord = prescription.patientId
      ? await this.patientRepository.findOne({
          where: { id: prescription.patientId },
          select: ['id', 'name', 'cpf', 'birthDate', 'gender'],
        })
      : null;
    const dependentRecord = prescription.dependentId
      ? await this.dependentRepository.findOne({
          where: { id: prescription.dependentId },
          select: ['id', 'name', 'birthDate', 'gender'],
        })
      : null;

    return {
      documentType: 'prescription',
      title: 'Receita Médica',
      doctor: {
        name: doctor?.name || '',
        crm: doctor?.crm || '',
        specialty: doctor?.specialty || null,
      },
      patient: {
        name: patientRecord?.name || dependentRecord?.name || 'Paciente',
        cpf: patientRecord?.cpf || null,
        birthDate: patientRecord?.birthDate || dependentRecord?.birthDate || null,
        gender: patientRecord?.gender || dependentRecord?.gender || null,
      },
      issueDate: prescription.issueDate,
      sections: [
        ...prescription.items.map((item, index) => ({
          kind: 'key-values' as const,
          heading: `Medicamento ${index + 1}`,
          items: [
            { label: 'Nome', value: item.name },
            { label: 'Concentração', value: item.concentration || '' },
            { label: 'Forma farmacêutica', value: item.pharmaceuticalForm || '' },
            { label: 'Quantidade', value: item.quantity || '' },
            { label: 'Posologia', value: item.posology || '' },
            { label: 'Via de administração', value: item.routeOfAdministration || '' },
            { label: 'Duração do tratamento', value: item.treatmentDuration || '' },
          ],
        })),
        ...(prescription.observations
          ? [
              {
                kind: 'plain-text' as const,
                heading: 'Observações',
                text: prescription.observations,
              },
            ]
          : []),
      ],
      signatureStatus: prescription.signatureStatus,
    };
  }

  async preview(id: string, userId: string): Promise<MedicalDocumentSpec> {
    // Goes through `findOne` so permission checks and the READ audit event
    // apply to previews exactly as they do to any other read.
    const prescription = await this.findOne(id, userId);
    return this.buildSpec(prescription);
  }

  /** Soft "cancelar" — keeps the row (and its audit trail) but takes it out
   * of circulation. Preferred over `delete` for anything already generated. */
  async cancel(id: string, userId: string) {
    const prescription = await this.findOwnedByDoctor(id, userId);

    if (prescription.status === DocumentStatus.SIGNED) {
      throw new ConflictException(
        'This prescription has already been signed and can no longer be canceled — issue a new one instead',
      );
    }
    if (prescription.status === DocumentStatus.CANCELED) {
      throw new ConflictException('This prescription is already canceled');
    }

    const statusBefore = prescription.status;
    prescription.status = DocumentStatus.CANCELED;
    const saved = await this.prescriptionRepository.save(prescription);

    await this.auditService.recordUpdate(
      AuditResourceType.PRESCRIPTION,
      id,
      { status: { before: statusBefore, after: saved.status } },
      { patientId: prescription.patientId || undefined, metadata: { operation: 'cancel' } },
    );

    return saved;
  }

  /** "Enviar sem assinatura digital" — delivers the already-generated PDF to
   * the patient as-is. Only reachable from GENERATED: a draft has no PDF
   * yet, and a signed/sent/canceled document doesn't get re-sent this way. */
  async send(id: string, userId: string) {
    const prescription = await this.findOwnedByDoctor(id, userId);

    if (prescription.status !== DocumentStatus.GENERATED) {
      throw new ConflictException(
        'Only a generated prescription (with a PDF already produced) can be sent',
      );
    }

    const statusBefore = prescription.status;
    prescription.status = DocumentStatus.SENT;
    const saved = await this.prescriptionRepository.save(prescription);

    await this.notifyPatient(
      saved,
      'Nova receita disponível',
      'Seu médico enviou uma nova receita. Acesse o app para visualizá-la.',
      'PRESCRIPTION_SENT',
    );

    await this.auditService.recordUpdate(
      AuditResourceType.PRESCRIPTION,
      id,
      { status: { before: statusBefore, after: saved.status } },
      { patientId: prescription.patientId || undefined, metadata: { operation: 'send' } },
    );

    return saved;
  }

  /** "Assinar digitalmente e enviar" (step 1 of 2) — starts an async
   * signature request and returns the URL the doctor is sent to in a new tab
   * to actually sign (today, `web/src/pages/SignatureSimulator.tsx`; a real
   * DocuSign envelope's hosted signing page once a real provider is wired
   * in). Delivery to the patient happens once `confirmSignature` runs. */
  async requestSignature(
    id: string,
    userId: string,
  ): Promise<{ prescription: Prescription; signingUrl: string }> {
    const prescription = await this.findOwnedByDoctor(id, userId);

    if (prescription.status !== DocumentStatus.GENERATED) {
      throw new ConflictException(
        'Only a generated prescription (with a PDF already produced) can be signed',
      );
    }
    if (prescription.signatureStatus !== SignatureStatus.NONE) {
      throw new ConflictException('A signature has already been requested for this prescription');
    }
    if (!prescription.documentUrl || !prescription.documentHash) {
      throw new ConflictException('No PDF available to sign');
    }

    const spec = await this.buildSpec(prescription);
    const response = await fetch(prescription.documentUrl);
    if (!response.ok) {
      throw new ConflictException('Could not fetch the stored PDF to start the signature request');
    }
    const pdfBuffer = Buffer.from(await response.arrayBuffer());

    const requestResult = await this.signatureService.requestSignature({
      documentId: prescription.id,
      documentType: 'prescription',
      documentHash: prescription.documentHash,
      pdfBuffer,
      signerName: spec.doctor.name,
    });

    prescription.signatureStatus = requestResult.status;
    prescription.signatureProvider = requestResult.provider;
    prescription.externalSignatureId = requestResult.externalSignatureId;
    const saved = await this.prescriptionRepository.save(prescription);

    await this.auditService.recordUpdate(
      AuditResourceType.PRESCRIPTION,
      id,
      { signatureStatus: { before: SignatureStatus.NONE, after: saved.signatureStatus } },
      {
        patientId: prescription.patientId || undefined,
        metadata: { operation: 'request-signature' },
      },
    );

    return { prescription: saved, signingUrl: requestResult.signingUrl };
  }

  /** "Assinar digitalmente e enviar" (step 2 of 2) — called by the signature-
   * simulator page once the doctor "signs" there (a real provider would call
   * an equivalent endpoint from its webhook instead). Marks the prescription
   * signed and delivers it to the patient in the same step: in this flow,
   * signing implies sending. */
  async confirmSignature(id: string, userId: string, externalSignatureId: string) {
    const prescription = await this.findOwnedByDoctor(id, userId);

    if (prescription.signatureStatus !== SignatureStatus.PENDING) {
      throw new ConflictException('No pending signature request for this prescription');
    }
    if (prescription.externalSignatureId !== externalSignatureId) {
      throw new ForbiddenException('This signature request does not belong to this prescription');
    }

    const result = await this.signatureService.completeSignature(externalSignatureId);
    if (result.status !== SignatureStatus.SIGNED) {
      prescription.signatureStatus = SignatureStatus.FAILED;
      await this.prescriptionRepository.save(prescription);
      throw new ConflictException('The signature request could not be completed');
    }

    const statusBefore = prescription.status;
    prescription.signatureStatus = result.status;
    prescription.signedAt = result.signedAt;
    prescription.status = DocumentStatus.SIGNED;
    const saved = await this.prescriptionRepository.save(prescription);

    await this.notifyPatient(
      saved,
      'Nova receita disponível',
      'Seu médico assinou digitalmente uma nova receita. Acesse o app para visualizá-la.',
      'PRESCRIPTION_SIGNED',
    );

    await this.auditService.recordUpdate(
      AuditResourceType.PRESCRIPTION,
      id,
      { status: { before: statusBefore, after: saved.status } },
      {
        patientId: prescription.patientId || undefined,
        metadata: { operation: 'confirm-signature' },
      },
    );

    return saved;
  }

  /** Best-effort patient notification — a patient without a push token or a
   * dependent with no reachable responsible simply gets nothing, same as the
   * existing access-request notifications this mirrors. Never blocks the
   * caller on failure. */
  private async notifyPatient(
    prescription: Prescription,
    title: string,
    body: string,
    type: string,
  ): Promise<void> {
    if (prescription.patientId) {
      this.notificationsService
        .createNotification(
          prescription.patientId,
          'patient',
          title,
          body,
          type,
          {
            prescriptionId: prescription.id,
          },
          prescription.id,
        )
        .catch(() => {
          /* notification is best-effort */
        });
      return;
    }

    if (prescription.dependentId) {
      const dependent = await this.dependentRepository.findOne({
        where: { id: prescription.dependentId },
        relations: ['responsibles'],
      });
      for (const responsible of dependent?.responsibles ?? []) {
        this.notificationsService
          .createNotification(
            responsible.id,
            'patient',
            title,
            body,
            type,
            {
              prescriptionId: prescription.id,
              dependentId: prescription.dependentId,
            },
            prescription.id,
          )
          .catch(() => {
            /* notification is best-effort */
          });
      }
    }
  }

  /** Resolves the stored PDF URL for an authorized viewer, recording a
   * DOWNLOAD audit event — the PDF is patient data, so handing out its URL
   * is itself an access worth logging. */
  async getDocumentUrl(id: string, userId: string): Promise<string> {
    const prescription = await this.findOne(id, userId);

    if (!prescription.documentUrl) {
      throw new NotFoundException('PDF not generated yet');
    }

    await this.auditService.recordSecurityEvent(AuditAction.DOWNLOAD, {
      resourceType: AuditResourceType.PRESCRIPTION,
      resourceId: id,
      patientId: prescription.patientId || undefined,
      metadata: { documentHash: prescription.documentHash },
    });

    return prescription.documentUrl;
  }

  private async findOwnedByDoctor(id: string, doctorId: string) {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    if (prescription.doctorId !== doctorId) {
      throw new ForbiddenException('Only the doctor who issued this prescription can manage it');
    }

    return prescription;
  }

  private async canAccess(prescription: Prescription, userId: string): Promise<boolean> {
    if (prescription.doctorId === userId) {
      return true;
    }

    return this.doctorsService.hasPermission(
      userId,
      prescription.patientId,
      prescription.dependentId,
    );
  }
}
