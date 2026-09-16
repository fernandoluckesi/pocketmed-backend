import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { DoctorDocument } from '../entities/doctor-document.entity';
import { Doctor } from '../entities/doctor.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditResourceType } from '../audit/audit.constants';
import { EmailService } from '../email/email.service';
import { ListSubmissionsQueryDto } from './dto/list-submissions.query.dto';

const REQUIRED_DOCUMENT_TYPES = ['CIM', 'DIPLOMA', 'REGULARIDADE', 'RQE'];

/** Human-readable names used in the emails sent to doctors. */
const DOCUMENT_LABELS: Record<string, string> = {
  CIM: 'Carteira de Identidade Médica (CIM)',
  DIPLOMA: 'Diploma de Graduação em Medicina',
  REGULARIDADE: 'Certificado de Regularidade de Inscrição',
  RQE: 'Comprovante de RQE',
};

type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

@Injectable()
export class BackofficeVerificationService {
  constructor(
    @InjectRepository(DoctorDocument)
    private documentRepository: Repository<DoctorDocument>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  /** Sensitive doctor fields are never exposed to the back office listing. */
  private sanitizeDoctor(doctor: Doctor) {
    return {
      id: doctor.id,
      name: doctor.name,
      email: doctor.email,
      specialty: doctor.specialty,
      crm: doctor.crm,
      profileImage: doctor.profileImage,
      verificationStatus: doctor.verificationStatus,
      createdAt: doctor.createdAt,
    };
  }

  /**
   * Lists doctors that submitted credentials for review, newest first, with the
   * per-document status summary used by the review queue.
   */
  async listSubmissions(query: ListSubmissionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.doctorRepository.createQueryBuilder('doctor');

    // Default queue: only what is actually waiting for a decision.
    qb.where('doctor.verificationStatus = :status', {
      status: query.status || 'SUBMITTED',
    });

    if (query.search?.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('LOWER(doctor.name) LIKE :term', { term })
            .orWhere('LOWER(doctor.email) LIKE :term', { term })
            .orWhere('LOWER(doctor.crm) LIKE :term', { term });
        }),
      );
    }

    const [doctors, total] = await qb
      .orderBy('doctor.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    if (doctors.length === 0) {
      return { data: [], total, page, limit };
    }

    const documents = await this.documentRepository.find({
      where: { doctorId: In(doctors.map((d) => d.id)) },
    });

    const data = doctors.map((doctor) => {
      const docs = documents.filter((d) => d.doctorId === doctor.id);
      return {
        ...this.sanitizeDoctor(doctor),
        documents: REQUIRED_DOCUMENT_TYPES.map((type) => {
          const doc = docs.find((d) => d.type === type);
          return {
            id: doc?.id || null,
            type,
            uploaded: !!doc,
            status: doc?.status || 'NOT_UPLOADED',
            originalFileName: doc?.originalFileName || null,
            rejectionReason: doc?.rejectionReason || null,
            reviewedAt: doc?.reviewedAt || null,
          };
        }),
        pendingCount: docs.filter((d) => d.status === 'PENDING').length,
      };
    });

    // Reading the review queue exposes professional data → audit it.
    await this.auditService.recordRead(AuditResourceType.PROFESSIONAL, 'QUEUE', {
      metadata: { status: query.status || 'SUBMITTED', total, page, limit },
    });

    return { data, total, page, limit };
  }

  /** Full submission detail, including the document file URLs for review. */
  async getSubmission(doctorId: string) {
    const doctor = await this.doctorRepository.findOne({ where: { id: doctorId } });
    if (!doctor) {
      throw new NotFoundException('Médico não encontrado.');
    }

    const documents = await this.documentRepository.find({
      where: { doctorId },
      order: { createdAt: 'DESC' },
    });

    // Viewing credential documents is sensitive → audit the access.
    await this.auditService.recordRead(AuditResourceType.PROFESSIONAL, doctorId, {
      metadata: { documentCount: documents.length },
    });

    return {
      doctor: this.sanitizeDoctor(doctor),
      documents: REQUIRED_DOCUMENT_TYPES.map((type) => {
        const doc = documents.find((d) => d.type === type);
        return {
          id: doc?.id || null,
          type,
          uploaded: !!doc,
          status: doc?.status || 'NOT_UPLOADED',
          fileUrl: doc?.fileUrl || null,
          originalFileName: doc?.originalFileName || null,
          rejectionReason: doc?.rejectionReason || null,
          reviewedAt: doc?.reviewedAt || null,
          reviewedBy: doc?.reviewedBy || null,
        };
      }),
    };
  }

  async approveDocument(documentId: string, reviewerId: string, note?: string) {
    return this.reviewDocument(documentId, reviewerId, 'APPROVED', undefined, note);
  }

  async rejectDocument(documentId: string, reviewerId: string, rejectionReason: string) {
    return this.reviewDocument(documentId, reviewerId, 'REJECTED', rejectionReason);
  }

  /**
   * Applies a review decision to a single document and recomputes the doctor's
   * overall verification status. Every decision is written to the audit trail.
   */
  private async reviewDocument(
    documentId: string,
    reviewerId: string,
    status: Extract<DocumentStatus, 'APPROVED' | 'REJECTED'>,
    rejectionReason?: string,
    note?: string,
  ) {
    const document = await this.documentRepository.findOne({ where: { id: documentId } });
    if (!document) {
      throw new NotFoundException('Documento não encontrado.');
    }

    if (document.status === status) {
      const label = status === 'APPROVED' ? 'aprovado' : 'rejeitado';
      throw new BadRequestException(`Este documento já foi ${label}.`);
    }

    const previousStatus = document.status;

    document.status = status;
    document.rejectionReason = status === 'REJECTED' ? (rejectionReason as string) : null;
    document.reviewedAt = new Date();
    document.reviewedBy = reviewerId;

    const saved = await this.documentRepository.save(document);
    const verificationStatus = await this.recomputeDoctorVerificationStatus(document.doctorId);

    await this.notifyDoctorOfDecision(
      document.doctorId,
      document.type,
      status,
      verificationStatus,
      rejectionReason,
    );

    // REQ: approvals/rejections must be traceable (who, when, what changed).
    await this.auditService.record({
      action: status === 'APPROVED' ? AuditAction.APPROVE : AuditAction.REJECT,
      resourceType: AuditResourceType.DOCTOR_DOCUMENT,
      resourceId: documentId,
      success: true,
      reason: status === 'REJECTED' ? rejectionReason : undefined,
      changedFields: { status: { before: previousStatus, after: status } },
      metadata: {
        doctorId: document.doctorId,
        documentType: document.type,
        reviewerId,
        note,
        doctorVerificationStatus: verificationStatus,
      },
    });

    return { ...saved, doctorVerificationStatus: verificationStatus };
  }

  /**
   * Emails the doctor about the decision. Failures are swallowed by EmailService,
   * so a mail outage never rolls back an already persisted (and audited) review.
   */
  private async notifyDoctorOfDecision(
    doctorId: string,
    documentType: string,
    status: 'APPROVED' | 'REJECTED',
    verificationStatus: string,
    rejectionReason?: string,
  ) {
    const doctor = await this.doctorRepository.findOne({ where: { id: doctorId } });
    if (!doctor?.email) return;

    const label = DOCUMENT_LABELS[documentType] || documentType;

    if (status === 'REJECTED') {
      await this.emailService.sendDocumentRejectedNotice(
        doctor.email,
        doctor.name,
        label,
        rejectionReason || 'Documento não aprovado pela análise.',
      );
      return;
    }

    // Fully verified → send the completion email instead of a per-document one.
    if (verificationStatus === 'APPROVED') {
      await this.emailService.sendVerificationApprovedNotice(doctor.email, doctor.name);
      return;
    }

    await this.emailService.sendDocumentApprovedNotice(doctor.email, doctor.name, label);
  }

  /**
   * Doctor is APPROVED only when all required documents are approved; a single
   * rejection puts the whole submission back to REJECTED.
   */
  private async recomputeDoctorVerificationStatus(doctorId: string): Promise<string> {
    const documents = await this.documentRepository.find({ where: { doctorId } });

    const byType = new Map(documents.map((d) => [d.type, d]));
    const allUploaded = REQUIRED_DOCUMENT_TYPES.every((t) => byType.has(t));
    const hasRejected = REQUIRED_DOCUMENT_TYPES.some((t) => byType.get(t)?.status === 'REJECTED');
    const allApproved =
      allUploaded && REQUIRED_DOCUMENT_TYPES.every((t) => byType.get(t)?.status === 'APPROVED');

    let verificationStatus = 'SUBMITTED';
    if (hasRejected) {
      verificationStatus = 'REJECTED';
    } else if (allApproved) {
      verificationStatus = 'APPROVED';
    } else if (!allUploaded) {
      verificationStatus = 'PENDING';
    }

    await this.doctorRepository.update(doctorId, { verificationStatus });
    return verificationStatus;
  }

  /** Counters for the back office dashboard/queue badges. */
  async getStats() {
    const [pending, submitted, approved, rejected] = await Promise.all([
      this.doctorRepository.count({ where: { verificationStatus: 'PENDING' } }),
      this.doctorRepository.count({ where: { verificationStatus: 'SUBMITTED' } }),
      this.doctorRepository.count({ where: { verificationStatus: 'APPROVED' } }),
      this.doctorRepository.count({ where: { verificationStatus: 'REJECTED' } }),
    ]);

    return { pending, submitted, approved, rejected };
  }
}
