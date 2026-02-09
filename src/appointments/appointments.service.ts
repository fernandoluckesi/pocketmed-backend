import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from '../entities/appointment.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Dependent } from '../entities/dependent.entity';
import { DoctorsService } from '../doctors/doctors.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Dependent)
    private dependentRepository: Repository<Dependent>,
    private doctorsService: DoctorsService,
  ) {}

  async create(doctorId: string, dto: CreateAppointmentDto) {
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
        'You do not have permission to create appointments for this patient/dependent',
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

    const appointment = this.appointmentRepository.create({
      ...dto,
      doctorId,
      dateTime: new Date(dto.dateTime),
      status: AppointmentStatus.PENDING,
    });

    return await this.appointmentRepository.save(appointment);
  }

  async findAll(userId: string, userType: string) {
    if (userType === 'doctor') {
      return await this.appointmentRepository.find({
        where: { doctorId: userId },
        relations: ['patient', 'dependent'],
      });
    }

    if (userType === 'patient') {
      const patientAppointments = await this.appointmentRepository.find({
        where: { patientId: userId },
        relations: ['doctor'],
      });

      const dependents = await this.dependentRepository
        .createQueryBuilder('dependent')
        .leftJoinAndSelect('dependent.responsibles', 'responsibles')
        .where('responsibles.id = :userId', { userId })
        .getMany();

      const dependentIds = dependents.map((d) => d.id);

      let dependentAppointments = [];
      if (dependentIds.length > 0) {
        dependentAppointments = await this.appointmentRepository
          .createQueryBuilder('appointment')
          .leftJoinAndSelect('appointment.doctor', 'doctor')
          .leftJoinAndSelect('appointment.dependent', 'dependent')
          .where('appointment.dependentId IN (:...dependentIds)', { dependentIds })
          .getMany();
      }

      return [...patientAppointments, ...dependentAppointments];
    }

    return [];
  }

  async findOne(id: string, userId: string, userType: string) {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: ['doctor', 'patient', 'dependent', 'dependent.responsibles'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const canAccess = await this.canAccessAppointment(appointment, userId, userType);

    if (!canAccess) {
      throw new ForbiddenException('You do not have permission to view this appointment');
    }

    return appointment;
  }

  async update(id: string, userId: string, userType: string, dto: UpdateAppointmentDto) {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: ['dependent', 'dependent.responsibles'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (userType !== 'doctor' || appointment.doctorId !== userId) {
      throw new ForbiddenException('Only the doctor who created the appointment can update it');
    }

    Object.assign(appointment, dto);

    if (dto.dateTime) {
      appointment.dateTime = new Date(dto.dateTime);
    }

    return await this.appointmentRepository.save(appointment);
  }

  async respondToAppointment(id: string, status: AppointmentStatus, userId: string, userType: string) {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: ['dependent', 'dependent.responsibles'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (userType !== 'patient') {
      throw new ForbiddenException('Only patients can respond to appointments');
    }

    if (appointment.patientId && appointment.patientId !== userId) {
      throw new ForbiddenException('You can only respond to your own appointments');
    }

    if (appointment.dependentId) {
      const isResponsible = appointment.dependent.responsibles.some((r) => r.id === userId);

      if (!isResponsible) {
        throw new ForbiddenException('You are not responsible for this dependent');
      }
    }

    appointment.status = status;
    await this.appointmentRepository.save(appointment);

    return {
      message: `Appointment ${status}`,
      appointment,
    };
  }

  async delete(id: string, userId: string, userType: string) {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (userType !== 'doctor' || appointment.doctorId !== userId) {
      throw new ForbiddenException('Only the doctor who created the appointment can delete it');
    }

    await this.appointmentRepository.remove(appointment);

    return {
      message: 'Appointment deleted successfully',
    };
  }

  private async canAccessAppointment(
    appointment: Appointment,
    userId: string,
    userType: string,
  ): Promise<boolean> {
    if (userType === 'doctor') {
      if (appointment.doctorId === userId) {
        return true;
      }

      const hasPermission = await this.doctorsService.hasPermission(
        userId,
        appointment.patientId,
        appointment.dependentId,
      );

      return hasPermission;
    }

    if (userType === 'patient') {
      if (appointment.patientId === userId) {
        return true;
      }

      if (appointment.dependentId && appointment.dependent?.responsibles) {
        return appointment.dependent.responsibles.some((r) => r.id === userId);
      }
    }

    return false;
  }
}
