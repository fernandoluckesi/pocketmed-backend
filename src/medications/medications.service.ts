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
    private doctorsService: DoctorsService,
  ) {}

  async create(doctorId: string, dto: CreateMedicationDto) {
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

  async findAll(userId: string, userType: string) {
    if (userType === 'doctor') {
      return await this.medicationRepository.find({
        where: { doctorId: userId },
        relations: ['doctor', 'patient', 'dependent', 'appointment'],
      });
    }

    if (userType === 'patient') {
      const patientMedications = await this.medicationRepository.find({
        where: { patientId: userId },
        relations: ['doctor', 'patient', 'dependent', 'appointment'],
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
      relations: ['doctor', 'patient', 'dependent', 'dependent.responsibles', 'appointment'],
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
      relations: ['dependent', 'dependent.responsibles'],
    });

    if (!medication) {
      throw new NotFoundException('Medication not found');
    }

    if (userType !== 'doctor' || medication.doctorId !== userId) {
      throw new ForbiddenException('Only the doctor who created the medication can update it');
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
    });

    if (!medication) {
      throw new NotFoundException('Medication not found');
    }

    if (userType !== 'doctor' || medication.doctorId !== userId) {
      throw new ForbiddenException('Only the doctor who created the medication can delete it');
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
