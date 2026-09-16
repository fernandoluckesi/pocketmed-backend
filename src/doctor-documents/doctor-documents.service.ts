import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorDocument } from '../entities/doctor-document.entity';
import { Doctor } from '../entities/doctor.entity';
import { UploadService } from '../upload/upload.service';

const VALID_DOCUMENT_TYPES = ['CIM', 'DIPLOMA', 'REGULARIDADE', 'RQE'];

@Injectable()
export class DoctorDocumentsService {
  constructor(
    @InjectRepository(DoctorDocument)
    private documentRepository: Repository<DoctorDocument>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    private uploadService: UploadService,
  ) {}

  async uploadDocument(
    doctorId: string,
    type: string,
    file: Express.Multer.File,
  ): Promise<DoctorDocument> {
    if (!VALID_DOCUMENT_TYPES.includes(type)) {
      throw new BadRequestException(
        `Tipo de documento inválido. Use um destes: ${VALID_DOCUMENT_TYPES.join(', ')}`,
      );
    }

    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado.');
    }

    const doctor = await this.doctorRepository.findOne({ where: { id: doctorId } });
    if (!doctor) {
      throw new NotFoundException('Médico não encontrado.');
    }

    const existing = await this.documentRepository.findOne({
      where: { doctorId, type },
    });

    // Validated BEFORE uploading: otherwise a rejected request would still leave
    // an orphan file in the storage bucket.
    if (existing?.status === 'PENDING') {
      throw new BadRequestException(
        'Este documento está em análise e não pode ser alterado até haver um retorno.',
      );
    }

    const fileUrl = await this.uploadService.uploadFile(file, `documents/doctors/${doctorId}`);

    if (existing) {
      existing.fileUrl = fileUrl;
      existing.originalFileName = file.originalname;
      existing.status = 'PENDING';
      existing.rejectionReason = null;
      existing.reviewedAt = null;
      existing.reviewedBy = null;
      const saved = await this.documentRepository.save(existing);
      await this.updateDoctorVerificationStatus(doctorId);
      return saved;
    }

    // Create new document record
    const document = this.documentRepository.create({
      doctorId,
      type,
      fileUrl,
      originalFileName: file.originalname,
      status: 'PENDING',
    });

    const saved = await this.documentRepository.save(document);

    // Update doctor verification status to SUBMITTED if all 4 docs are uploaded
    await this.updateDoctorVerificationStatus(doctorId);

    return saved;
  }

  async getDocumentsByDoctor(doctorId: string): Promise<DoctorDocument[]> {
    return this.documentRepository.find({
      where: { doctorId },
      order: { createdAt: 'DESC' },
    });
  }

  async getVerificationStatus(doctorId: string) {
    const documents = await this.documentRepository.find({
      where: { doctorId },
    });

    const doctor = await this.doctorRepository.findOne({ where: { id: doctorId } });

    const documentStatus = VALID_DOCUMENT_TYPES.map((type) => {
      const doc = documents.find((d) => d.type === type);
      const status = doc?.status || 'NOT_UPLOADED';
      return {
        id: doc?.id || null,
        type,
        uploaded: !!doc,
        status,
        fileUrl: doc?.fileUrl || null,
        originalFileName: doc?.originalFileName || null,
        rejectionReason: doc?.rejectionReason || null,
        reviewedAt: doc?.reviewedAt || null,
        submittedAt: doc?.updatedAt || null,
        // Drives the UI lock: a document under review cannot be replaced.
        canReplace: status !== 'PENDING',
      };
    });

    return {
      verificationStatus: doctor?.verificationStatus || 'PENDING',
      documents: documentStatus,
      allUploaded: documentStatus.every((d) => d.uploaded),
      allApproved: documentStatus.every((d) => d.status === 'APPROVED'),
      pendingCount: documentStatus.filter((d) => d.status === 'PENDING').length,
      rejectedCount: documentStatus.filter((d) => d.status === 'REJECTED').length,
    };
  }

  /**
   * Recomputes the doctor's overall status from the individual documents.
   * Mirrors the back office logic so both sides always agree.
   */
  private async updateDoctorVerificationStatus(doctorId: string) {
    const documents = await this.documentRepository.find({ where: { doctorId } });
    const byType = new Map(documents.map((d) => [d.type, d]));

    const allUploaded = VALID_DOCUMENT_TYPES.every((t) => byType.has(t));
    const hasRejected = VALID_DOCUMENT_TYPES.some((t) => byType.get(t)?.status === 'REJECTED');
    const allApproved =
      allUploaded && VALID_DOCUMENT_TYPES.every((t) => byType.get(t)?.status === 'APPROVED');

    let verificationStatus = 'PENDING';
    if (hasRejected) {
      verificationStatus = 'REJECTED';
    } else if (allApproved) {
      verificationStatus = 'APPROVED';
    } else if (allUploaded) {
      verificationStatus = 'SUBMITTED';
    }

    await this.doctorRepository.update(doctorId, { verificationStatus });
  }
}
