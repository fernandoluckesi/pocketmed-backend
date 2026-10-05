import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamRequest } from '../entities/exam-request.entity';
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
import { CreateExamRequestDto } from './dto/create-exam-request.dto';
import { UpdateExamRequestDto } from './dto/update-exam-request.dto';

@Injectable()
export class ExamRequestsService {
  constructor(
    @InjectRepository(ExamRequest)
    private examRequestRepository: Repository<ExamRequest>,
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

  async create(doctorId: string, dto: CreateExamRequestDto) {
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
        'You do not have permission to create exam requests for this patient/dependent',
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

    const examRequest = this.examRequestRepository.create({
      doctorId,
      patientId: dto.patientId || null,
      dependentId: dto.dependentId || null,
      appointmentId: dto.appointmentId || null,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
      items: dto.items,
      observations: dto.observations || null,
      status: DocumentStatus.DRAFT,
    });

    const saved = await this.examRequestRepository.save(examRequest);

    await this.auditService.recordCreate(AuditResourceType.EXAM_REQUEST, saved.id, {
      patientId: saved.patientId || undefined,
      metadata: { doctorId, dependentId: saved.dependentId },
    });

    return saved;
  }

  async findAll(doctorId: string, patientId?: string) {
    return this.examRequestRepository.find({
      where: {
        doctorId,
        ...(patientId ? { patientId } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string) {
    const examRequest = await this.examRequestRepository.findOne({ where: { id } });

    if (!examRequest) {
      throw new NotFoundException('Exam request not found');
    }

    if (!(await this.canAccess(examRequest, userId))) {
      await this.auditService.recordAccessDenied(AuditResourceType.EXAM_REQUEST, {
        resourceId: id,
        patientId: examRequest.patientId || undefined,
        reason: 'INSUFFICIENT_PERMISSION',
      });
      throw new ForbiddenException('You do not have permission to view this exam request');
    }

    await this.auditService.recordRead(AuditResourceType.EXAM_REQUEST, id, {
      patientId: examRequest.patientId || undefined,
    });

    return examRequest;
  }

  async update(id: string, userId: string, dto: UpdateExamRequestDto) {
    const examRequest = await this.findOwnedByDoctor(id, userId);

    if (examRequest.status === DocumentStatus.SIGNED) {
      throw new ConflictException(
        'This exam request has already been signed and can no longer be edited — generate a new one instead',
      );
    }

    const changedFields: Record<string, { before?: unknown; after?: unknown }> = {};
    for (const key of Object.keys(dto) as (keyof UpdateExamRequestDto)[]) {
      if (dto[key] !== undefined) {
        changedFields[key] = { before: (examRequest as any)[key], after: dto[key] };
      }
    }

    if (dto.items) examRequest.items = dto.items;
    if (dto.observations !== undefined) examRequest.observations = dto.observations;
    if (dto.issueDate) examRequest.issueDate = new Date(dto.issueDate);

    const saved = await this.examRequestRepository.save(examRequest);

    await this.auditService.recordUpdate(AuditResourceType.EXAM_REQUEST, id, changedFields, {
      patientId: examRequest.patientId || undefined,
    });

    return saved;
  }

  async delete(id: string, userId: string) {
    const examRequest = await this.findOwnedByDoctor(id, userId);

    if (examRequest.status === DocumentStatus.SIGNED) {
      throw new ConflictException(
        'This exam request has already been signed and cannot be deleted',
      );
    }

    await this.examRequestRepository.remove(examRequest);

    await this.auditService.recordDelete(AuditResourceType.EXAM_REQUEST, id, {
      patientId: examRequest.patientId || undefined,
      metadata: { doctorId: examRequest.doctorId },
    });

    return { message: 'Exam request deleted successfully' };
  }

  /** The exact document the PDF renderer is fed. Exposed (read-only) through
   * `GET /exam-requests/:id/preview` so "Visualizar pedido" shows the same
   * spec the PDF is drawn from instead of the frontend rebuilding it. */
  private async buildSpec(examRequest: ExamRequest): Promise<MedicalDocumentSpec> {
    // Explicit column allowlist — Doctor/Patient/Dependent don't mark
    // `password` as `select: false`, so a plain `findOne` would pull the
    // bcrypt hash into memory. Only ever select what the PDF actually prints.
    const doctor = await this.doctorRepository.findOne({
      where: { id: examRequest.doctorId },
      select: ['id', 'name', 'crm', 'specialty'],
    });
    const patientRecord = examRequest.patientId
      ? await this.patientRepository.findOne({
          where: { id: examRequest.patientId },
          select: ['id', 'name', 'cpf', 'birthDate', 'gender'],
        })
      : null;
    const dependentRecord = examRequest.dependentId
      ? await this.dependentRepository.findOne({
          where: { id: examRequest.dependentId },
          select: ['id', 'name', 'birthDate', 'gender'],
        })
      : null;

    return {
      documentType: 'exam',
      title: 'Pedido de Exame',
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
      issueDate: examRequest.issueDate,
      sections: [
        {
          kind: 'key-values',
          heading: 'Exames solicitados',
          items: examRequest.items.map((item, index) => ({
            label: `${index + 1}`,
            value: item.name,
          })),
        },
        ...(examRequest.observations
          ? [
              {
                kind: 'plain-text' as const,
                heading: 'Observações',
                text: examRequest.observations,
              },
            ]
          : []),
      ],
      signatureStatus: examRequest.signatureStatus,
    };
  }

  async preview(id: string, userId: string): Promise<MedicalDocumentSpec> {
    const examRequest = await this.findOne(id, userId);
    return this.buildSpec(examRequest);
  }

  async generatePdf(id: string, userId: string) {
    const examRequest = await this.findOwnedByDoctor(id, userId);

    if (examRequest.status === DocumentStatus.SIGNED) {
      throw new ConflictException('This exam request has already been signed and is immutable');
    }

    const spec = await this.buildSpec(examRequest);

    const pdfBuffer = await this.documentGenerationService.renderToBuffer(spec);
    const documentHash = this.documentGenerationService.computeHash(pdfBuffer);

    const signatureResult = await this.signatureService.signDocument({
      pdfBuffer,
      documentHash,
      documentId: examRequest.id,
      signerName: spec.doctor.name,
    });

    const documentUrl = await this.documentGenerationService.store(signatureResult.pdfBuffer, {
      folder: DOCUMENT_FOLDERS.examRequests,
      filenameHint: examRequest.id,
    });

    const statusBefore = examRequest.status;

    examRequest.documentUrl = documentUrl;
    examRequest.documentHash = documentHash;
    examRequest.signatureStatus = signatureResult.status;
    examRequest.signatureProvider = signatureResult.provider;
    examRequest.signedAt = signatureResult.signedAt;
    examRequest.externalSignatureId = signatureResult.externalSignatureId;
    examRequest.status = DocumentStatus.GENERATED;

    const saved = await this.examRequestRepository.save(examRequest);

    await this.auditService.recordUpdate(
      AuditResourceType.EXAM_REQUEST,
      id,
      { status: { before: statusBefore, after: saved.status } },
      { patientId: examRequest.patientId || undefined, metadata: { documentHash } },
    );

    return saved;
  }

  /** Soft "cancelar" — keeps the row (and its audit trail) but takes it out
   * of circulation. Preferred over `delete` for anything already generated. */
  async cancel(id: string, userId: string) {
    const examRequest = await this.findOwnedByDoctor(id, userId);

    if (examRequest.status === DocumentStatus.SIGNED) {
      throw new ConflictException(
        'This exam request has already been signed and can no longer be canceled — issue a new one instead',
      );
    }
    if (examRequest.status === DocumentStatus.CANCELED) {
      throw new ConflictException('This exam request is already canceled');
    }

    const statusBefore = examRequest.status;
    examRequest.status = DocumentStatus.CANCELED;
    const saved = await this.examRequestRepository.save(examRequest);

    await this.auditService.recordUpdate(
      AuditResourceType.EXAM_REQUEST,
      id,
      { status: { before: statusBefore, after: saved.status } },
      { patientId: examRequest.patientId || undefined, metadata: { operation: 'cancel' } },
    );

    return saved;
  }

  /** "Enviar sem assinatura digital" — delivers the already-generated PDF to
   * the patient as-is. */
  async send(id: string, userId: string) {
    const examRequest = await this.findOwnedByDoctor(id, userId);

    if (examRequest.status !== DocumentStatus.GENERATED) {
      throw new ConflictException(
        'Only a generated exam request (with a PDF already produced) can be sent',
      );
    }

    const statusBefore = examRequest.status;
    examRequest.status = DocumentStatus.SENT;
    const saved = await this.examRequestRepository.save(examRequest);

    await this.notifyPatient(
      saved,
      'Novo pedido de exame disponível',
      'Seu médico enviou um novo pedido de exame. Acesse o app para visualizá-lo.',
      'EXAM_REQUEST_SENT',
    );

    await this.auditService.recordUpdate(
      AuditResourceType.EXAM_REQUEST,
      id,
      { status: { before: statusBefore, after: saved.status } },
      { patientId: examRequest.patientId || undefined, metadata: { operation: 'send' } },
    );

    return saved;
  }

  /** "Assinar digitalmente e enviar" (step 1 of 2) — starts an async
   * signature request and returns the URL the doctor is sent to in a new tab
   * to actually sign. Delivery to the patient happens once
   * `confirmSignature` runs. */
  async requestSignature(
    id: string,
    userId: string,
  ): Promise<{ examRequest: ExamRequest; signingUrl: string }> {
    const examRequest = await this.findOwnedByDoctor(id, userId);

    if (examRequest.status !== DocumentStatus.GENERATED) {
      throw new ConflictException(
        'Only a generated exam request (with a PDF already produced) can be signed',
      );
    }
    if (examRequest.signatureStatus !== SignatureStatus.NONE) {
      throw new ConflictException('A signature has already been requested for this exam request');
    }
    if (!examRequest.documentUrl || !examRequest.documentHash) {
      throw new ConflictException('No PDF available to sign');
    }

    const spec = await this.buildSpec(examRequest);
    const response = await fetch(examRequest.documentUrl);
    if (!response.ok) {
      throw new ConflictException('Could not fetch the stored PDF to start the signature request');
    }
    const pdfBuffer = Buffer.from(await response.arrayBuffer());

    const requestResult = await this.signatureService.requestSignature({
      documentId: examRequest.id,
      documentType: 'exam',
      documentHash: examRequest.documentHash,
      pdfBuffer,
      signerName: spec.doctor.name,
    });

    examRequest.signatureStatus = requestResult.status;
    examRequest.signatureProvider = requestResult.provider;
    examRequest.externalSignatureId = requestResult.externalSignatureId;
    const saved = await this.examRequestRepository.save(examRequest);

    await this.auditService.recordUpdate(
      AuditResourceType.EXAM_REQUEST,
      id,
      { signatureStatus: { before: SignatureStatus.NONE, after: saved.signatureStatus } },
      {
        patientId: examRequest.patientId || undefined,
        metadata: { operation: 'request-signature' },
      },
    );

    return { examRequest: saved, signingUrl: requestResult.signingUrl };
  }

  /** "Assinar digitalmente e enviar" (step 2 of 2) — called by the signature-
   * simulator page once the doctor "signs" there. Marks the exam request
   * signed and delivers it to the patient in the same step. */
  async confirmSignature(id: string, userId: string, externalSignatureId: string) {
    const examRequest = await this.findOwnedByDoctor(id, userId);

    if (examRequest.signatureStatus !== SignatureStatus.PENDING) {
      throw new ConflictException('No pending signature request for this exam request');
    }
    if (examRequest.externalSignatureId !== externalSignatureId) {
      throw new ForbiddenException('This signature request does not belong to this exam request');
    }

    const result = await this.signatureService.completeSignature(externalSignatureId);
    if (result.status !== SignatureStatus.SIGNED) {
      examRequest.signatureStatus = SignatureStatus.FAILED;
      await this.examRequestRepository.save(examRequest);
      throw new ConflictException('The signature request could not be completed');
    }

    const statusBefore = examRequest.status;
    examRequest.signatureStatus = result.status;
    examRequest.signedAt = result.signedAt;
    examRequest.status = DocumentStatus.SIGNED;
    const saved = await this.examRequestRepository.save(examRequest);

    await this.notifyPatient(
      saved,
      'Novo pedido de exame disponível',
      'Seu médico assinou digitalmente um novo pedido de exame. Acesse o app para visualizá-lo.',
      'EXAM_REQUEST_SIGNED',
    );

    await this.auditService.recordUpdate(
      AuditResourceType.EXAM_REQUEST,
      id,
      { status: { before: statusBefore, after: saved.status } },
      {
        patientId: examRequest.patientId || undefined,
        metadata: { operation: 'confirm-signature' },
      },
    );

    return saved;
  }

  /** Best-effort patient notification — never blocks the caller on failure. */
  private async notifyPatient(
    examRequest: ExamRequest,
    title: string,
    body: string,
    type: string,
  ): Promise<void> {
    if (examRequest.patientId) {
      this.notificationsService
        .createNotification(
          examRequest.patientId,
          'patient',
          title,
          body,
          type,
          { examRequestId: examRequest.id },
          examRequest.id,
        )
        .catch(() => {
          /* notification is best-effort */
        });
      return;
    }

    if (examRequest.dependentId) {
      const dependent = await this.dependentRepository.findOne({
        where: { id: examRequest.dependentId },
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
            { examRequestId: examRequest.id, dependentId: examRequest.dependentId },
            examRequest.id,
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
    const examRequest = await this.findOne(id, userId);

    if (!examRequest.documentUrl) {
      throw new NotFoundException('PDF not generated yet');
    }

    await this.auditService.recordSecurityEvent(AuditAction.DOWNLOAD, {
      resourceType: AuditResourceType.EXAM_REQUEST,
      resourceId: id,
      patientId: examRequest.patientId || undefined,
      metadata: { documentHash: examRequest.documentHash },
    });

    return examRequest.documentUrl;
  }

  private async findOwnedByDoctor(id: string, doctorId: string) {
    const examRequest = await this.examRequestRepository.findOne({ where: { id } });

    if (!examRequest) {
      throw new NotFoundException('Exam request not found');
    }

    if (examRequest.doctorId !== doctorId) {
      throw new ForbiddenException('Only the doctor who issued this exam request can manage it');
    }

    return examRequest;
  }

  private async canAccess(examRequest: ExamRequest, userId: string): Promise<boolean> {
    if (examRequest.doctorId === userId) {
      return true;
    }

    return this.doctorsService.hasPermission(
      userId,
      examRequest.patientId,
      examRequest.dependentId,
    );
  }
}
