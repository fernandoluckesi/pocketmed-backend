import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certificate } from '../entities/certificate.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Dependent } from '../entities/dependent.entity';
import { Appointment } from '../entities/appointment.entity';
import { DoctorsService } from '../doctors/doctors.service';
import { UploadService } from '../upload/upload.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';

@Injectable()
export class CertificatesService {
  constructor(
    @InjectRepository(Certificate)
    private certificateRepository: Repository<Certificate>,
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
  ) {}

  async create(
    userId: string,
    userType: string,
    dto: CreateCertificateDto,
    file?: Express.Multer.File,
  ) {
    if (userType === 'patient') {
      return this.createByPatient(userId, dto, file);
    }

    return this.createByDoctor(userId, dto, file);
  }

  private async createByDoctor(
    doctorId: string,
    dto: CreateCertificateDto,
    file?: Express.Multer.File,
  ) {
    if (!dto.patientId && !dto.dependentId) {
      throw new BadRequestException('Either patientId or dependentId must be provided');
    }

    if (dto.patientId && dto.dependentId) {
      throw new BadRequestException('Provide either patientId or dependentId, not both');
    }

    const doctor = await this.doctorRepository.findOne({ where: { id: doctorId } });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const hasPermission = await this.doctorsService.hasPermission(
      doctorId,
      dto.patientId,
      dto.dependentId,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to create certificates for this patient/dependent',
      );
    }

    if (dto.patientId) {
      const patient = await this.patientRepository.findOne({ where: { id: dto.patientId } });
      if (!patient) {
        throw new NotFoundException('Patient not found');
      }
    }

    if (dto.dependentId) {
      const dependent = await this.dependentRepository.findOne({ where: { id: dto.dependentId } });
      if (!dependent) {
        throw new NotFoundException('Dependent not found');
      }
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

    let fileUrl: string | null = null;
    if (file) {
      fileUrl = await this.uploadService.uploadFile(file, 'certificates');
    }

    const certificate = this.certificateRepository.create({
      ...dto,
      doctorId,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
      fileUrl,
    });

    return await this.certificateRepository.save(certificate);
  }

  /**
   * A patient self-reporting a certificate they received (mirrors
   * ExamsService.createByPatient). Unlike exams, appointmentId is optional —
   * a patient may log a certificate without having recorded the underlying
   * consultation. No acting doctor user, so doctorId stays null; the CRM the
   * patient types in is what identifies the issuing doctor on the document.
   */
  private async createByPatient(
    patientUserId: string,
    dto: CreateCertificateDto,
    file?: Express.Multer.File,
  ) {
    let patientId: string | null = null;
    let dependentId: string | null = null;

    if (dto.dependentId) {
      const dependent = await this.dependentRepository
        .createQueryBuilder('dependent')
        .leftJoinAndSelect('dependent.responsibles', 'responsibles')
        .where('dependent.id = :dependentId', { dependentId: dto.dependentId })
        .getOne();

      if (!dependent) {
        throw new NotFoundException('Dependent not found');
      }

      const isResponsible = dependent.responsibles.some((r) => r.id === patientUserId);
      if (!isResponsible) {
        throw new ForbiddenException('You are not responsible for this dependent');
      }

      dependentId = dependent.id;
    } else {
      patientId = patientUserId;
    }

    if (dto.appointmentId) {
      const appointment = await this.appointmentRepository.findOne({
        where: { id: dto.appointmentId },
      });
      const belongsToTarget = dependentId
        ? appointment?.dependentId === dependentId
        : appointment?.patientId === patientId;
      if (!appointment || !belongsToTarget) {
        throw new BadRequestException('appointmentId inválido ou não pertence a este paciente');
      }
    }

    let fileUrl: string | null = null;
    if (file) {
      fileUrl = await this.uploadService.uploadFile(file, 'certificates');
    }

    const certificate = this.certificateRepository.create({
      crm: dto.crm,
      cid: dto.cid,
      description: dto.description,
      daysOff: dto.daysOff,
      appointmentId: dto.appointmentId,
      doctorId: null,
      patientId,
      dependentId,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
      fileUrl,
    });

    return await this.certificateRepository.save(certificate);
  }

  async findAll(userId: string, userType: string, patientId?: string) {
    if (userType === 'doctor') {
      return await this.certificateRepository.find({
        where: {
          doctorId: userId,
          ...(patientId ? { patientId } : {}),
        },
        relations: ['doctor', 'patient', 'dependent', 'appointment'],
        order: { createdAt: 'DESC' },
      });
    }

    if (userType === 'patient') {
      const patientCertificates = await this.certificateRepository.find({
        where: { patientId: userId },
        relations: ['doctor', 'patient', 'dependent', 'appointment'],
        order: { createdAt: 'DESC' },
      });

      const dependents = await this.dependentRepository
        .createQueryBuilder('dependent')
        .leftJoinAndSelect('dependent.responsibles', 'responsibles')
        .where('responsibles.id = :userId', { userId })
        .getMany();

      const dependentIds = dependents.map((d) => d.id);

      let dependentCertificates: Certificate[] = [];
      if (dependentIds.length > 0) {
        dependentCertificates = await this.certificateRepository
          .createQueryBuilder('certificate')
          .leftJoinAndSelect('certificate.doctor', 'doctor')
          .leftJoinAndSelect('certificate.patient', 'patient')
          .leftJoinAndSelect('certificate.dependent', 'dependent')
          .leftJoinAndSelect('certificate.appointment', 'appointment')
          .where('certificate.dependentId IN (:...dependentIds)', { dependentIds })
          .getMany();
      }

      return [...patientCertificates, ...dependentCertificates];
    }

    return [];
  }

  async findOne(id: string, userId: string, userType: string) {
    const certificate = await this.certificateRepository.findOne({
      where: { id },
      relations: ['doctor', 'patient', 'dependent', 'dependent.responsibles', 'appointment'],
    });

    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    const canAccess = await this.canAccessCertificate(certificate, userId, userType);
    if (!canAccess) {
      throw new ForbiddenException('You do not have permission to view this certificate');
    }

    return certificate;
  }

  async update(
    id: string,
    userId: string,
    userType: string,
    dto: UpdateCertificateDto,
    file?: Express.Multer.File,
  ) {
    const certificate = await this.certificateRepository.findOne({
      where: { id },
      relations: ['dependent', 'dependent.responsibles'],
    });
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    const isOwnerDoctor = userType === 'doctor' && certificate.doctorId === userId;
    const isOwnerPatient =
      userType === 'patient' &&
      (certificate.patientId === userId ||
        (certificate.dependentId &&
          certificate.dependent?.responsibles?.some((r) => r.id === userId)));

    if (!isOwnerDoctor && !isOwnerPatient) {
      throw new ForbiddenException(
        'Only the doctor who issued the certificate or the patient who owns it can update it',
      );
    }

    Object.assign(certificate, dto);

    if (dto.issueDate) {
      certificate.issueDate = new Date(dto.issueDate);
    }

    if (file) {
      if (certificate.fileUrl) {
        await this.uploadService.deleteFile(certificate.fileUrl);
      }
      certificate.fileUrl = await this.uploadService.uploadFile(file, 'certificates');
    }

    return await this.certificateRepository.save(certificate);
  }

  async delete(id: string, userId: string, userType: string) {
    const certificate = await this.certificateRepository.findOne({
      where: { id },
      relations: ['dependent', 'dependent.responsibles'],
    });
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    const isOwnerDoctor = userType === 'doctor' && certificate.doctorId === userId;
    const isOwnerPatient =
      userType === 'patient' &&
      (certificate.patientId === userId ||
        (certificate.dependentId &&
          certificate.dependent?.responsibles?.some((r) => r.id === userId)));

    if (!isOwnerDoctor && !isOwnerPatient) {
      throw new ForbiddenException(
        'Only the doctor who issued the certificate or the patient who owns it can delete it',
      );
    }

    if (certificate.fileUrl) {
      await this.uploadService.deleteFile(certificate.fileUrl);
    }

    await this.certificateRepository.remove(certificate);

    return { message: 'Certificate deleted successfully' };
  }

  private async canAccessCertificate(
    certificate: Certificate,
    userId: string,
    userType: string,
  ): Promise<boolean> {
    if (userType === 'doctor') {
      if (certificate.doctorId === userId) {
        return true;
      }

      return await this.doctorsService.hasPermission(
        userId,
        certificate.patientId,
        certificate.dependentId,
      );
    }

    if (userType === 'patient') {
      if (certificate.patientId === userId) {
        return true;
      }

      if (certificate.dependentId && certificate.dependent?.responsibles) {
        return certificate.dependent.responsibles.some((r) => r.id === userId);
      }
    }

    return false;
  }
}
