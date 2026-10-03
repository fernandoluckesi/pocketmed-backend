import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, REPORT_TYPE_LABELS, ReportType } from '../entities/report.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Dependent } from '../entities/dependent.entity';
import { Appointment } from '../entities/appointment.entity';
import { DoctorsService } from '../doctors/doctors.service';
import { UploadService } from '../upload/upload.service';
import { DocumentGenerationService } from '../documents/document-generation.service';
import { SignatureService } from '../documents/signature/signature.service';
import {
  DOCUMENT_FOLDERS,
  DocumentStatus,
  MedicalDocumentSpec,
  DocumentSection,
} from '../documents/document.types';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditResourceType } from '../audit/audit.constants';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

const CLINICAL_FIELDS = [
  { key: 'chiefComplaint', heading: 'Queixa / Motivo' },
  { key: 'clinicalHistory', heading: 'História clínica' },
  { key: 'physicalExam', heading: 'Exame físico' },
  { key: 'complementaryExams', heading: 'Exames complementares' },
  { key: 'results', heading: 'Resultados' },
  { key: 'diagnosis', heading: 'Diagnóstico' },
  { key: 'conclusion', heading: 'Conclusão' },
  { key: 'recommendations', heading: 'Conduta / Recomendações' },
  { key: 'observations', heading: 'Observações' },
] as const;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Dependent)
    private dependentRepository: Repository<Dependent>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    private doctorsService: DoctorsService,
    private uploadService: UploadService,
    private documentGenerationService: DocumentGenerationService,
    private signatureService: SignatureService,
    private auditService: AuditService,
  ) {}

  async create(doctorId: string, dto: CreateReportDto) {
    if (!dto.patientId && !dto.dependentId) {
      throw new BadRequestException('Either patientId or dependentId must be provided');
    }
    if (dto.patientId && dto.dependentId) {
      throw new BadRequestException('Provide either patientId or dependentId, not both');
    }
    if (dto.reportType === ReportType.OUTRO && !dto.reportTypeOther?.trim()) {
      throw new BadRequestException('reportTypeOther is required when reportType is "outro"');
    }

    const hasPermission = await this.doctorsService.hasPermission(
      doctorId,
      dto.patientId,
      dto.dependentId,
    );
    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to create reports for this patient/dependent',
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

    // Doctor/patient identification is snapshotted now and never re-derived
    // from a later profile edit — the printed document must stay consistent
    // with what was true when the laudo was created.
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id', 'name', 'crm', 'specialty'],
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const patientRecord = dto.patientId
      ? await this.patientRepository.findOne({
          where: { id: dto.patientId },
          select: ['id', 'name', 'cpf', 'birthDate', 'gender'],
        })
      : null;
    const dependentRecord = dto.dependentId
      ? await this.dependentRepository.findOne({
          where: { id: dto.dependentId },
          select: ['id', 'name', 'birthDate', 'gender'],
        })
      : null;

    if (dto.patientId && !patientRecord) {
      throw new NotFoundException('Patient not found');
    }
    if (dto.dependentId && !dependentRecord) {
      throw new NotFoundException('Dependent not found');
    }

    const report = this.reportRepository.create({
      doctorId,
      patientId: dto.patientId || null,
      dependentId: dto.dependentId || null,
      appointmentId: dto.appointmentId || null,
      reportType: dto.reportType,
      reportTypeOther: dto.reportType === ReportType.OUTRO ? dto.reportTypeOther || null : null,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
      relatedServiceDate: dto.relatedServiceDate ? new Date(dto.relatedServiceDate) : null,
      purpose: dto.purpose || null,
      title: dto.title,
      doctorNameSnapshot: doctor.name,
      doctorCrmSnapshot: doctor.crm,
      doctorSpecialtySnapshot: doctor.specialty || null,
      patientNameSnapshot: patientRecord?.name || dependentRecord?.name || 'Paciente',
      patientCpfSnapshot: patientRecord?.cpf || null,
      patientBirthDateSnapshot: patientRecord?.birthDate || dependentRecord?.birthDate || null,
      patientGenderSnapshot: patientRecord?.gender || dependentRecord?.gender || null,
      chiefComplaint: dto.chiefComplaint || null,
      clinicalHistory: dto.clinicalHistory || null,
      physicalExam: dto.physicalExam || null,
      complementaryExams: dto.complementaryExams || null,
      results: dto.results || null,
      diagnosis: dto.diagnosis || null,
      conclusion: dto.conclusion || null,
      recommendations: dto.recommendations || null,
      observations: dto.observations || null,
      status: DocumentStatus.DRAFT,
    });

    const saved = await this.reportRepository.save(report);

    await this.auditService.recordCreate(AuditResourceType.REPORT, saved.id, {
      patientId: saved.patientId || undefined,
      metadata: { doctorId, dependentId: saved.dependentId, reportType: saved.reportType },
    });

    return saved;
  }

  async findAll(
    doctorId: string,
    filters: {
      patientId?: string;
      status?: DocumentStatus;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
  ) {
    const query = this.reportRepository
      .createQueryBuilder('report')
      // Scoped to the authenticated doctor's own reports — never a shared pool.
      .where('report.doctorId = :doctorId', { doctorId })
      .orderBy('report.createdAt', 'DESC');

    if (filters.patientId) {
      query.andWhere('report.patientId = :patientId', { patientId: filters.patientId });
    }
    if (filters.status) {
      query.andWhere('report.status = :status', { status: filters.status });
    }
    if (filters.startDate) {
      query.andWhere('report.issueDate >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      query.andWhere('report.issueDate <= :endDate', { endDate: filters.endDate });
    }
    if (filters.search?.trim()) {
      // Matches the snapshotted patient name (what the document actually
      // prints) rather than the live patient row, so the list and the PDF
      // never disagree. Parameterized — never string-interpolated.
      query.andWhere('report.patientNameSnapshot LIKE :search', {
        search: `%${filters.search.trim()}%`,
      });
    }

    return query.getMany();
  }

  async findOne(id: string, userId: string) {
    const report = await this.reportRepository.findOne({ where: { id } });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (!(await this.canAccess(report, userId))) {
      await this.auditService.recordAccessDenied(AuditResourceType.REPORT, {
        resourceId: id,
        patientId: report.patientId || undefined,
        reason: 'INSUFFICIENT_PERMISSION',
      });
      throw new ForbiddenException('You do not have permission to view this report');
    }

    await this.auditService.recordRead(AuditResourceType.REPORT, id, {
      patientId: report.patientId || undefined,
    });

    return report;
  }

  async update(id: string, userId: string, dto: UpdateReportDto) {
    const report = await this.findOwnedByDoctor(id, userId);

    if (report.status === DocumentStatus.SIGNED) {
      throw new ConflictException(
        'This report has already been signed and can no longer be edited — generate a new one instead',
      );
    }

    if ((dto.reportType || report.reportType) === ReportType.OUTRO) {
      const other =
        dto.reportTypeOther !== undefined ? dto.reportTypeOther : report.reportTypeOther;
      if (!other?.trim()) {
        throw new BadRequestException('reportTypeOther is required when reportType is "outro"');
      }
    }

    const changedFields: Record<string, { before?: unknown; after?: unknown }> = {};
    for (const key of Object.keys(dto) as (keyof UpdateReportDto)[]) {
      if (dto[key] !== undefined) {
        changedFields[key] = { before: (report as any)[key], after: dto[key] };
      }
    }

    if (dto.reportType !== undefined) report.reportType = dto.reportType;
    if (dto.reportTypeOther !== undefined) report.reportTypeOther = dto.reportTypeOther;
    if (dto.issueDate) report.issueDate = new Date(dto.issueDate);
    if (dto.relatedServiceDate !== undefined) {
      report.relatedServiceDate = dto.relatedServiceDate ? new Date(dto.relatedServiceDate) : null;
    }
    if (dto.purpose !== undefined) report.purpose = dto.purpose;
    if (dto.title !== undefined) report.title = dto.title;
    for (const field of CLINICAL_FIELDS) {
      const value = dto[field.key];
      if (value !== undefined) {
        (report as any)[field.key] = value;
      }
    }

    const saved = await this.reportRepository.save(report);

    await this.auditService.recordUpdate(AuditResourceType.REPORT, id, changedFields, {
      patientId: report.patientId || undefined,
    });

    return saved;
  }

  async delete(id: string, userId: string) {
    const report = await this.findOwnedByDoctor(id, userId);

    if (report.status === DocumentStatus.SIGNED) {
      throw new ConflictException('This report has already been signed and cannot be deleted');
    }

    await this.reportRepository.remove(report);

    await this.auditService.recordDelete(AuditResourceType.REPORT, id, {
      patientId: report.patientId || undefined,
      metadata: { doctorId: report.doctorId },
    });

    return { message: 'Report deleted successfully' };
  }

  /** The exact document the PDF renderer is fed. Exposed (read-only) through
   * `GET /reports/:id/preview` so the "Visualizar laudo" screen renders the
   * same spec the PDF is drawn from, instead of the frontend rebuilding the
   * document's structure and drifting from it. */
  private buildSpec(report: Report): MedicalDocumentSpec {
    const sections: DocumentSection[] = [];
    if (report.purpose) {
      sections.push({ kind: 'plain-text', heading: 'Finalidade', text: report.purpose });
    }
    for (const field of CLINICAL_FIELDS) {
      const content = (report as any)[field.key];
      if (content) {
        sections.push({ kind: 'rich-text', heading: field.heading, content });
      }
    }

    const reportTypeLabel =
      report.reportType === ReportType.OUTRO
        ? report.reportTypeOther
        : REPORT_TYPE_LABELS[report.reportType];

    return {
      documentType: 'report',
      title: report.title || reportTypeLabel || 'Laudo Médico',
      doctor: {
        name: report.doctorNameSnapshot,
        crm: report.doctorCrmSnapshot,
        specialty: report.doctorSpecialtySnapshot,
      },
      patient: {
        name: report.patientNameSnapshot,
        cpf: report.patientCpfSnapshot,
        birthDate: report.patientBirthDateSnapshot,
        gender: report.patientGenderSnapshot,
      },
      issueDate: report.issueDate,
      sections,
      signatureStatus: report.signatureStatus,
    };
  }

  async preview(id: string, userId: string): Promise<MedicalDocumentSpec> {
    // Goes through `findOne` so permission checks and the READ audit event
    // apply to previews exactly as they do to any other read.
    const report = await this.findOne(id, userId);
    return this.buildSpec(report);
  }

  async generatePdf(id: string, userId: string) {
    const report = await this.findOwnedByDoctor(id, userId);

    if (report.status === DocumentStatus.SIGNED) {
      throw new ConflictException('This report has already been signed and is immutable');
    }

    const spec = this.buildSpec(report);

    const pdfBuffer = await this.documentGenerationService.renderToBuffer(spec);
    const documentHash = this.documentGenerationService.computeHash(pdfBuffer);

    const signatureResult = await this.signatureService.signDocument({
      pdfBuffer,
      documentHash,
      documentId: report.id,
      signerName: report.doctorNameSnapshot,
    });

    const documentUrl = await this.documentGenerationService.store(signatureResult.pdfBuffer, {
      folder: DOCUMENT_FOLDERS.reports,
      filenameHint: report.id,
    });

    const statusBefore = report.status;

    report.documentUrl = documentUrl;
    report.documentHash = documentHash;
    report.signatureStatus = signatureResult.status;
    report.signatureProvider = signatureResult.provider;
    report.signedAt = signatureResult.signedAt;
    report.externalSignatureId = signatureResult.externalSignatureId;
    report.status = DocumentStatus.GENERATED;

    const saved = await this.reportRepository.save(report);

    await this.auditService.recordUpdate(
      AuditResourceType.REPORT,
      id,
      { status: { before: statusBefore, after: saved.status } },
      { patientId: report.patientId || undefined, metadata: { documentHash } },
    );

    return saved;
  }

  /** Soft "cancelar" — keeps the row (and its audit trail) but takes it out
   * of circulation. Preferred over `delete` for anything already generated. */
  async cancel(id: string, userId: string) {
    const report = await this.findOwnedByDoctor(id, userId);

    if (report.status === DocumentStatus.SIGNED) {
      throw new ConflictException(
        'This report has already been signed and can no longer be canceled — issue a superseding one instead',
      );
    }
    if (report.status === DocumentStatus.CANCELED) {
      throw new ConflictException('This report is already canceled');
    }

    const statusBefore = report.status;
    report.status = DocumentStatus.CANCELED;
    const saved = await this.reportRepository.save(report);

    await this.auditService.recordUpdate(
      AuditResourceType.REPORT,
      id,
      { status: { before: statusBefore, after: saved.status } },
      { patientId: report.patientId || undefined, metadata: { operation: 'cancel' } },
    );

    return saved;
  }

  /**
   * Attaches a pre-existing document (a laudo the doctor issued outside
   * Hispora, possibly years ago) to this laudo. Stored in `fileUrl`, never
   * `documentUrl`: Hispora didn't generate it, so it must not flow into the
   * generate/hash/sign pipeline or be presented as something the platform
   * produced.
   */
  async attachFile(id: string, userId: string, file: Express.Multer.File) {
    const report = await this.findOwnedByDoctor(id, userId);

    if (report.status === DocumentStatus.SIGNED) {
      throw new ConflictException(
        'This report has already been signed and can no longer be modified',
      );
    }

    if (!this.uploadService.isAvailable) {
      throw new ServiceUnavailableException(
        'Armazenamento de arquivos indisponível. Tente novamente mais tarde.',
      );
    }

    const previousFileUrl = report.fileUrl;
    const fileUrl = await this.uploadService.uploadFile(file, DOCUMENT_FOLDERS.medicalDocuments);
    if (!fileUrl) {
      throw new ServiceUnavailableException('Não foi possível armazenar o arquivo.');
    }

    report.fileUrl = fileUrl;
    const saved = await this.reportRepository.save(report);

    // Replacing an attachment: drop the old object so superseded patient
    // documents don't linger in storage.
    if (previousFileUrl && previousFileUrl !== fileUrl) {
      await this.uploadService.deleteFile(previousFileUrl).catch(() => {
        // Best-effort cleanup — the new attachment is already saved.
      });
    }

    await this.auditService.recordUpdate(
      AuditResourceType.REPORT,
      id,
      { fileUrl: { before: previousFileUrl, after: fileUrl } },
      {
        patientId: report.patientId || undefined,
        metadata: { operation: 'attach-file', originalName: file.originalname },
      },
    );

    return saved;
  }

  /** Removes the uploaded attachment, leaving the laudo's own content intact. */
  async removeFile(id: string, userId: string) {
    const report = await this.findOwnedByDoctor(id, userId);

    if (report.status === DocumentStatus.SIGNED) {
      throw new ConflictException(
        'This report has already been signed and can no longer be modified',
      );
    }
    if (!report.fileUrl) {
      throw new NotFoundException('This report has no attachment');
    }

    const previousFileUrl = report.fileUrl;
    report.fileUrl = null;
    const saved = await this.reportRepository.save(report);

    await this.uploadService.deleteFile(previousFileUrl).catch(() => {
      // Best-effort — the reference is already cleared in the DB.
    });

    await this.auditService.recordUpdate(
      AuditResourceType.REPORT,
      id,
      { fileUrl: { before: previousFileUrl, after: null } },
      { patientId: report.patientId || undefined, metadata: { operation: 'remove-file' } },
    );

    return saved;
  }

  /** Resolves the stored PDF URL for an authorized viewer, recording a
   * DOWNLOAD audit event — the PDF is patient data, so handing out its URL
   * is itself an access worth logging. */
  async getDocumentUrl(id: string, userId: string): Promise<string> {
    const report = await this.findOne(id, userId);

    if (!report.documentUrl) {
      throw new NotFoundException('PDF not generated yet');
    }

    await this.auditService.recordSecurityEvent(AuditAction.DOWNLOAD, {
      resourceType: AuditResourceType.REPORT,
      resourceId: id,
      patientId: report.patientId || undefined,
      metadata: { documentHash: report.documentHash },
    });

    return report.documentUrl;
  }

  private async findOwnedByDoctor(id: string, doctorId: string) {
    const report = await this.reportRepository.findOne({ where: { id } });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.doctorId !== doctorId) {
      throw new ForbiddenException('Only the doctor who issued this report can manage it');
    }

    return report;
  }

  private async canAccess(report: Report, userId: string): Promise<boolean> {
    if (report.doctorId === userId) {
      return true;
    }

    return this.doctorsService.hasPermission(userId, report.patientId, report.dependentId);
  }
}
