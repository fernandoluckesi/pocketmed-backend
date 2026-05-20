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
        `Invalid document type. Must be one of: ${VALID_DOCUMENT_TYPES.join(', ')}`,
      );
    }

    const doctor = await this.doctorRepository.findOne({ where: { id: doctorId } });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Upload file to storage
    const fileUrl = await this.uploadService.uploadFile(file, `documents/doctors/${doctorId}`);

    // Check if document of this type already exists for this doctor
    const existing = await this.documentRepository.findOne({
      where: { doctorId, type },
    });

    if (existing) {
      // Update existing document
      existing.fileUrl = fileUrl;
      existing.originalFileName = file.originalname;
      existing.status = 'PENDING';
      existing.rejectionReason = null;
      existing.reviewedAt = null;
      return this.documentRepository.save(existing);
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
      return {
        type,
        uploaded: !!doc,
        status: doc?.status || 'NOT_UPLOADED',
        fileUrl: doc?.fileUrl || null,
        originalFileName: doc?.originalFileName || null,
        rejectionReason: doc?.rejectionReason || null,
      };
    });

    return {
      verificationStatus: doctor?.verificationStatus || 'PENDING',
      documents: documentStatus,
      allUploaded: documentStatus.every((d) => d.uploaded),
      allApproved: documentStatus.every((d) => d.status === 'APPROVED'),
    };
  }

  private async updateDoctorVerificationStatus(doctorId: string) {
    const documents = await this.documentRepository.find({
      where: { doctorId },
    });

    const uploadedTypes = documents.map((d) => d.type);
    const allUploaded = VALID_DOCUMENT_TYPES.every((t) => uploadedTypes.includes(t));

    if (allUploaded) {
      await this.doctorRepository.update(doctorId, { verificationStatus: 'SUBMITTED' });
    }
  }
}
