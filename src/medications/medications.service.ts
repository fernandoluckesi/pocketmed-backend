import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Medication } from '../entities/medication.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Dependent } from '../entities/dependent.entity';
import { Appointment } from '../entities/appointment.entity';
import { DoctorsService } from '../doctors/doctors.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';

@Injectable()
export class MedicationsService {
  constructor(
    @InjectRepository(Medication)
    private medicationRepository: Repository<Medication>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Dependent)
    private dependentRepository: Repository<Dependent>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    private doctorsService: DoctorsService,
  ) {}

  async create(userId: string, userType: string, dto: CreateMedicationDto) {
    if (userType === 'patient') {
      return this.createByPatient(userId, dto);
    }

    if (userType !== 'doctor') {
      throw new ForbiddenException('Only doctors and patients can create medications');
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
        'You do not have permission to create medications for this patient/dependent',
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

    const medication = this.medicationRepository.create({
      ...dto,
      doctorId,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
    });

    return await this.medicationRepository.save(medication);
  }

  private async createByPatient(patientUserId: string, dto: CreateMedicationDto) {
    // Two patient paths:
    //  (a) From a consultation: appointmentId is given → derive owner/doctor
    //      from the appointment (as before).
    //  (b) Standalone (e.g. "adicionar por receita"): no appointment — the
    //      patient logs a medication they received outside Hispora, for
    //      themselves or for a dependent they are responsible for.
    if (dto.appointmentId) {
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
        throw new ForbiddenException(
          'You can only create medication linked to your own appointment',
        );
      }

      const medication = this.medicationRepository.create({
        ...dto,
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        dependentId: appointment.dependentId,
        appointmentId: appointment.id,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      });

      return await this.medicationRepository.save(medication);
    }

    // Standalone: for a dependent, the caller must be one of its responsibles;
    // otherwise it belongs to the patient themselves.
    if (dto.dependentId) {
      const dependent = await this.dependentRepository.findOne({
        where: { id: dto.dependentId },
        relations: ['responsibles'],
      });
      if (!dependent) {
        throw new NotFoundException('Dependent not found');
      }
      const isResponsible = dependent.responsibles?.some((r) => r.id === patientUserId);
      if (!isResponsible) {
        throw new ForbiddenException('You are not responsible for this dependent');
      }
    }

    const medication = this.medicationRepository.create({
      ...dto,
      // No doctor for a patient-logged medication (external prescription).
      doctorId: null,
      patientId: dto.dependentId ? null : patientUserId,
      dependentId: dto.dependentId ?? null,
      appointmentId: null,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
    });

    return await this.medicationRepository.save(medication);
  }

  async findAll(userId: string, userType: string) {
    if (userType === 'doctor') {
      return await this.medicationRepository.find({
        where: { doctorId: userId },
        relations: ['doctor', 'patient', 'dependent', 'appointment', 'attachment'],
      });
    }

    if (userType === 'patient') {
      const patientMedications = await this.medicationRepository.find({
        where: { patientId: userId },
        relations: ['doctor', 'patient', 'dependent', 'appointment', 'attachment'],
      });

      const dependents = await this.dependentRepository
        .createQueryBuilder('dependent')
        .leftJoinAndSelect('dependent.responsibles', 'responsibles')
        .where('responsibles.id = :userId', { userId })
        .getMany();

      const dependentIds = dependents.map((d) => d.id);

      let dependentMedications = [];
      if (dependentIds.length > 0) {
        dependentMedications = await this.medicationRepository
          .createQueryBuilder('medication')
          .leftJoinAndSelect('medication.doctor', 'doctor')
          .leftJoinAndSelect('medication.patient', 'patient')
          .leftJoinAndSelect('medication.dependent', 'dependent')
          .leftJoinAndSelect('medication.appointment', 'appointment')
          .leftJoinAndSelect('medication.attachment', 'attachment')
          .where('medication.dependentId IN (:...dependentIds)', { dependentIds })
          .getMany();
      }

      return [...patientMedications, ...dependentMedications];
    }

    return [];
  }

  async findOne(id: string, userId: string, userType: string) {
    const medication = await this.medicationRepository.findOne({
      where: { id },
      relations: [
        'doctor',
        'patient',
        'dependent',
        'dependent.responsibles',
        'appointment',
        'attachment',
      ],
    });

    if (!medication) {
      throw new NotFoundException('Medication not found');
    }

    const canAccess = await this.canAccessMedication(medication, userId, userType);

    if (!canAccess) {
      throw new ForbiddenException('You do not have permission to view this medication');
    }

    return medication;
  }

  async update(id: string, userId: string, userType: string, dto: UpdateMedicationDto) {
    const medication = await this.medicationRepository.findOne({
      where: { id },
      relations: [
        'dependent',
        'dependent.responsibles',
        'appointment',
        'appointment.dependent',
        'appointment.dependent.responsibles',
      ],
    });

    if (!medication) {
      throw new NotFoundException('Medication not found');
    }

    const isOwnerDoctor = userType === 'doctor' && medication.doctorId === userId;

    const isOwnerPatient =
      userType === 'patient' &&
      (medication.patientId === userId ||
        (medication.dependentId &&
          medication.dependent?.responsibles?.some((r) => r.id === userId)) ||
        medication.appointment?.patientId === userId ||
        (medication.appointment?.dependentId &&
          medication.appointment.dependent?.responsibles?.some((r) => r.id === userId)));

    if (!isOwnerDoctor && !isOwnerPatient) {
      throw new ForbiddenException(
        'Only the doctor who created the medication or the patient who owns it can update it',
      );
    }

    // Mirrors the mobile app's own UI for a doctor-prescribed medication: the
    // patient only gets an "Editar Horários" screen (times/startDate/endDate),
    // never a field to rename, redose, or reinstruct it. That was UI-only —
    // nothing stopped a direct API call from changing the rest, which is
    // exactly the data integrity this lock exists to protect.
    if (isOwnerPatient && medication.lockedByDoctor) {
      const doctorOnlyFields: (keyof UpdateMedicationDto)[] = [
        'name',
        'dosage',
        'frequency',
        'duration',
        'instructions',
        'isActive',
        'isFinished',
      ];
      const attemptedDoctorOnlyChange = doctorOnlyFields.some(
        (field) => dto[field] !== undefined,
      );
      if (attemptedDoctorOnlyChange) {
        throw new ForbiddenException(
          'This medication was prescribed by a doctor — you can only adjust its times and start/end dates',
        );
      }
    }

    Object.assign(medication, dto);

    if (dto.startDate) {
      medication.startDate = new Date(dto.startDate);
    }

    if (dto.endDate) {
      medication.endDate = new Date(dto.endDate);
    }

    return await this.medicationRepository.save(medication);
  }

  async delete(id: string, userId: string, userType: string) {
    const medication = await this.medicationRepository.findOne({
      where: { id },
      relations: [
        'dependent',
        'dependent.responsibles',
        'appointment',
        'appointment.dependent',
        'appointment.dependent.responsibles',
      ],
    });

    if (!medication) {
      throw new NotFoundException('Medication not found');
    }

    const isOwnerDoctor = userType === 'doctor' && medication.doctorId === userId;

    const isOwnerPatient =
      userType === 'patient' &&
      (medication.patientId === userId ||
        (medication.dependentId &&
          medication.dependent?.responsibles?.some((r) => r.id === userId)) ||
        medication.appointment?.patientId === userId ||
        (medication.appointment?.dependentId &&
          medication.appointment.dependent?.responsibles?.some((r) => r.id === userId)));

    if (!isOwnerDoctor && !isOwnerPatient) {
      throw new ForbiddenException(
        'Only the doctor who created the medication or the patient who owns it can delete it',
      );
    }

    // Mirrors the mobile app, which hides "Excluir" entirely for a
    // doctor-prescribed medication — the patient was never offered this,
    // so a direct API call shouldn't be able to do it either.
    if (isOwnerPatient && medication.lockedByDoctor) {
      throw new ForbiddenException(
        'This medication was prescribed by a doctor and cannot be deleted',
      );
    }

    await this.medicationRepository.remove(medication);

    return {
      message: 'Medication deleted successfully',
    };
  }

  private async canAccessMedication(
    medication: Medication,
    userId: string,
    userType: string,
  ): Promise<boolean> {
    if (userType === 'doctor') {
      if (medication.doctorId === userId) {
        return true;
      }

      const hasPermission = await this.doctorsService.hasPermission(
        userId,
        medication.patientId,
        medication.dependentId,
      );

      return hasPermission;
    }

    if (userType === 'patient') {
      if (medication.patientId === userId) {
        return true;
      }

      if (medication.dependentId && medication.dependent?.responsibles) {
        return medication.dependent.responsibles.some((r) => r.id === userId);
      }
    }

    return false;
  }
}
