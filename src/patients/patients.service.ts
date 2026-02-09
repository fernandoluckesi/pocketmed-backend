import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Patient } from '../entities/patient.entity';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
  ) {}

  async findAll(userType: string) {
    if (userType !== 'doctor') {
      throw new ForbiddenException('Only doctors can view all patients');
    }

    const patients = await this.patientRepository.find({
      select: [
        'id',
        'name',
        'email',
        'gender',
        'phone',
        'birthDate',
        'profileImage',
        'type',
        'isShadow',
        'createdAt',
        'updatedAt',
      ],
    });

    return patients;
  }

  async findOne(id: string, userId: string, userType: string) {
    const patient = await this.patientRepository.findOne({
      where: { id },
      select: [
        'id',
        'name',
        'email',
        'gender',
        'phone',
        'birthDate',
        'profileImage',
        'type',
        'isShadow',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    if (userType === 'patient' && patient.id !== userId) {
      throw new ForbiddenException('You can only view your own profile');
    }

    return patient;
  }

  async search(query: string, userType: string) {
    if (userType !== 'doctor') {
      throw new ForbiddenException('Only doctors can search patients');
    }

    if (query.length < 3) {
      throw new ForbiddenException('Search query must be at least 3 characters');
    }

    const patients = await this.patientRepository.find({
      where: [{ name: Like(`%${query}%`) }, { email: Like(`%${query}%`) }],
      select: [
        'id',
        'name',
        'email',
        'gender',
        'phone',
        'birthDate',
        'profileImage',
        'type',
        'isShadow',
        'createdAt',
        'updatedAt',
      ],
    });

    return patients;
  }
}
