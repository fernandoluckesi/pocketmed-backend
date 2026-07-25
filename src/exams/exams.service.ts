import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exam } from '../entities/exam.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Dependent } from '../entities/dependent.entity';
import { Appointment } from '../entities/appointment.entity';
import { DoctorsService } from '../doctors/doctors.service';
import { UploadService } from '../upload/upload.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(Exam)
    private examRepository: Repository<Exam>,
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

  async create(userId: string, userType: string, dto: CreateExamDto, file?: Express.Multer.File) {
    if (userType === 'patient') {
      return this.createByPatient(userId, dto, file);
    }

    if (userType !== 'doctor') {
      throw new ForbiddenException('Only doctors and patients can create exams');
    }

    const doctorId = userId;

    if (!dto.patientId && !dto.dependentId) {
      throw new BadRequestException('Either patientId or dependentId must be provided');
    }

    if (dto.patientId && dto.dependentId) {
      throw new BadRequestException('Provide either patientId or dependentId, not both');
    }

    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
    });

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
        'You do not have permission to create exams for this patient/dependent',
      );
    }

    if (dto.patientId) {
      const patient = await this.patientRepository.findOne({
        where: { id: dto.patientId },
      });

      if (!patient) {
        throw new NotFoundException('Patient not found');
      }
    }

    if (dto.dependentId) {
      const dependent = await this.dependentRepository.findOne({
        where: { id: dto.dependentId },
      });

      if (!dependent) {
        throw new NotFoundException('Dependent not found');
      }
    }

    if (dto.appointmentId) {
      const appointment = await this.appointmentRepository.findOne({
        where: { id: dto.appointmentId },
      });
      if (!appointment || appointment.patientId !== dto.patientId) {
        throw new BadRequestException(
          'appointmentId inválido ou não pertence a este paciente',
        );
      }
    }

    let resultFileUrl = null;
    if (file) {
      resultFileUrl = await this.uploadService.uploadFile(file, 'exam-results');
    }

    const exam = this.examRepository.create({
      ...dto,
      doctorId,
      scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
      resultFile: resultFileUrl,
    });

    return await this.examRepository.save(exam);
  }

  private async createByPatient(
    patientUserId: string,
    dto: CreateExamDto,
    file?: Express.Multer.File,
  ) {
    if (!dto.appointmentId) {
      throw new BadRequestException('appointmentId is required when patient creates exam');
    }

    const appointment = await this.appointmentRepository.findOne({
      where: { id: dto.appointmentId },
      relations: ['dependent', 'dependent.responsibles'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const isOwnerPatient = appointment.patientId === patientUserId;
    const isResponsibleDependent =
      Boolean(appointment.dependentId) &&
      Boolean(appointment.dependent?.responsibles?.some((r) => r.id === patientUserId));

    if (!isOwnerPatient && !isResponsibleDependent) {
      throw new ForbiddenException('You can only create exam linked to your own appointment');
    }

    let resultFileUrl = null;
    if (file) {
      resultFileUrl = await this.uploadService.uploadFile(file, 'exam-results');
    }

    const exam = this.examRepository.create({
      ...dto,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      dependentId: appointment.dependentId,
      appointmentId: appointment.id,
      scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
      resultFile: resultFileUrl,
    });

    return await this.examRepository.save(exam);
  }

  async findAll(userId: string, userType: string) {
    if (userType === 'doctor') {
      return await this.examRepository.find({
        where: { doctorId: userId },
        relations: ['doctor', 'patient', 'dependent', 'appointment'],
      });
    }

    if (userType === 'patient') {
      const patientExams = await this.examRepository.find({
        where: { patientId: userId },
        relations: ['doctor', 'patient', 'dependent', 'appointment'],
      });

      const dependents = await this.dependentRepository
        .createQueryBuilder('dependent')
        .leftJoinAndSelect('dependent.responsibles', 'responsibles')
        .where('responsibles.id = :userId', { userId })
        .getMany();

      const dependentIds = dependents.map((d) => d.id);

      let dependentExams = [];
      if (dependentIds.length > 0) {
        dependentExams = await this.examRepository
          .createQueryBuilder('exam')
          .leftJoinAndSelect('exam.doctor', 'doctor')
          .leftJoinAndSelect('exam.patient', 'patient')
          .leftJoinAndSelect('exam.dependent', 'dependent')
          .leftJoinAndSelect('exam.appointment', 'appointment')
          .where('exam.dependentId IN (:...dependentIds)', { dependentIds })
          .getMany();
      }

      return [...patientExams, ...dependentExams];
    }

    return [];
  }

  async findOne(id: string, userId: string, userType: string) {
    const exam = await this.examRepository.findOne({
      where: { id },
      relations: ['doctor', 'patient', 'dependent', 'dependent.responsibles', 'appointment'],
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    const canAccess = await this.canAccessExam(exam, userId, userType);

    if (!canAccess) {
      throw new ForbiddenException('You do not have permission to view this exam');
    }

    return exam;
  }

  async update(
    id: string,
    userId: string,
    userType: string,
    dto: UpdateExamDto,
    file?: Express.Multer.File,
  ) {
    const exam = await this.examRepository.findOne({
      where: { id },
      relations: [
        'dependent',
        'dependent.responsibles',
        'appointment',
        'appointment.dependent',
        'appointment.dependent.responsibles',
      ],
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    const isOwnerDoctor = userType === 'doctor' && exam.doctorId === userId;

    const isOwnerPatient =
      userType === 'patient' &&
      (exam.patientId === userId ||
        (exam.dependentId && exam.dependent?.responsibles?.some((r) => r.id === userId)) ||
        exam.appointment?.patientId === userId ||
        (exam.appointment?.dependentId &&
          exam.appointment.dependent?.responsibles?.some((r) => r.id === userId)));

    if (!isOwnerDoctor && !isOwnerPatient) {
      throw new ForbiddenException(
        'Only the doctor who created the exam or the patient who owns it can update it',
      );
    }

    Object.assign(exam, dto);

    if (dto.scheduledDate) {
      exam.scheduledDate = new Date(dto.scheduledDate);
    }

    if (file) {
      if (exam.resultFile) {
        await this.uploadService.deleteFile(exam.resultFile);
      }
      exam.resultFile = await this.uploadService.uploadFile(file, 'exam-results');
    }

    return await this.examRepository.save(exam);
  }

  async submitResult(
    id: string,
    userId: string,
    userType: string,
    completedAt?: string,
    files?: Express.Multer.File[],
  ) {
    const exam = await this.examRepository.findOne({ where: { id } });
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    // Verify ownership
    if (userType === 'patient' && exam.patientId !== userId) {
      throw new ForbiddenException('You can only submit results for your own exams');
    }

    // Upload files
    const resultUrls: string[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const url = await this.uploadService.uploadFile(file, 'exam-results');
          if (url) resultUrls.push(url);
        } catch (err) {
          console.warn('File upload failed:', err.message);
        }
      }
    }

    exam.status = 'completed' as any;
    exam.completedAt = completedAt ? new Date(completedAt) : new Date();
    exam.resultFiles = resultUrls.length > 0 ? resultUrls : exam.resultFiles;

    return await this.examRepository.save(exam);
  }

  async delete(id: string, userId: string, userType: string) {
    const exam = await this.examRepository.findOne({
      where: { id },
      relations: [
        'dependent',
        'dependent.responsibles',
        'appointment',
        'appointment.dependent',
        'appointment.dependent.responsibles',
      ],
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    const isOwnerDoctor = userType === 'doctor' && exam.doctorId === userId;

    const isOwnerPatient =
      userType === 'patient' &&
      (exam.patientId === userId ||
        (exam.dependentId && exam.dependent?.responsibles?.some((r) => r.id === userId)) ||
        exam.appointment?.patientId === userId ||
        (exam.appointment?.dependentId &&
          exam.appointment.dependent?.responsibles?.some((r) => r.id === userId)));

    if (!isOwnerDoctor && !isOwnerPatient) {
      throw new ForbiddenException(
        'Only the doctor who created the exam or the patient who owns it can delete it',
      );
    }

    if (exam.resultFile) {
      await this.uploadService.deleteFile(exam.resultFile);
    }

    await this.examRepository.remove(exam);

    return {
      message: 'Exam deleted successfully',
    };
  }

  private async canAccessExam(exam: Exam, userId: string, userType: string): Promise<boolean> {
    if (userType === 'doctor') {
      if (exam.doctorId === userId) {
        return true;
      }

      const hasPermission = await this.doctorsService.hasPermission(
        userId,
        exam.patientId,
        exam.dependentId,
      );

      return hasPermission;
    }

    if (userType === 'patient') {
      if (exam.patientId === userId) {
        return true;
      }

      if (exam.dependentId && exam.dependent?.responsibles) {
        return exam.dependent.responsibles.some((r) => r.id === userId);
      }
    }

    return false;
  }
}
