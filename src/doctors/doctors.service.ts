import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Dependent } from '../entities/dependent.entity';
import { DoctorAccessRequest, AccessRequestStatus } from '../entities/doctor-access-request.entity';
import { DoctorPermission } from '../entities/doctor-permission.entity';
import { RequestAccessDto } from './dto/request-access.dto';

@Injectable()
export class DoctorsService {
  constructor(
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Dependent)
    private dependentRepository: Repository<Dependent>,
    @InjectRepository(DoctorAccessRequest)
    private accessRequestRepository: Repository<DoctorAccessRequest>,
    @InjectRepository(DoctorPermission)
    private permissionRepository: Repository<DoctorPermission>,
  ) {}

  async findAll() {
    return await this.doctorRepository.find({
      select: [
        'id',
        'name',
        'email',
        'gender',
        'specialty',
        'crm',
        'phone',
        'birthDate',
        'profileImage',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  async findOne(id: string) {
    const doctor = await this.doctorRepository.findOne({
      where: { id },
      select: [
        'id',
        'name',
        'email',
        'gender',
        'specialty',
        'crm',
        'phone',
        'birthDate',
        'profileImage',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return doctor;
  }

  async requestAccess(doctorId: string, dto: RequestAccessDto) {
    if (!dto.patientId && !dto.dependentId) {
      throw new BadRequestException('Either patientId or dependentId must be provided');
    }

    if (dto.patientId && dto.dependentId) {
      throw new BadRequestException('Provide either patientId or dependentId, not both');
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
        relations: ['responsibles'],
      });

      if (!dependent) {
        throw new NotFoundException('Dependent not found');
      }
    }

    const existingRequest = await this.accessRequestRepository.findOne({
      where: {
        doctorId,
        patientId: dto.patientId,
        dependentId: dto.dependentId,
        status: AccessRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new BadRequestException('Access request already pending');
    }

    const accessRequest = this.accessRequestRepository.create({
      doctorId,
      patientId: dto.patientId,
      dependentId: dto.dependentId,
      message: dto.message,
      status: AccessRequestStatus.PENDING,
    });

    return await this.accessRequestRepository.save(accessRequest);
  }

  async respondToAccessRequest(requestId: string, status: AccessRequestStatus, userId: string, userType: string) {
    const request = await this.accessRequestRepository.findOne({
      where: { id: requestId },
      relations: ['dependent', 'dependent.responsibles'],
    });

    if (!request) {
      throw new NotFoundException('Access request not found');
    }

    if (request.patientId) {
      if (userType !== 'patient' || request.patientId !== userId) {
        throw new ForbiddenException('You can only respond to your own access requests');
      }
    }

    if (request.dependentId) {
      if (userType !== 'patient') {
        throw new ForbiddenException('Only patients can respond to dependent access requests');
      }

      const isResponsible = request.dependent.responsibles.some((r) => r.id === userId);

      if (!isResponsible) {
        throw new ForbiddenException('You are not responsible for this dependent');
      }
    }

    request.status = status;
    await this.accessRequestRepository.save(request);

    if (status === AccessRequestStatus.APPROVED) {
      const permission = this.permissionRepository.create({
        doctorId: request.doctorId,
        patientId: request.patientId,
        dependentId: request.dependentId,
        isActive: true,
      });

      await this.permissionRepository.save(permission);
    }

    return {
      message: `Access request ${status}`,
      request,
    };
  }

  async getMyAccessRequests(doctorId: string) {
    return await this.accessRequestRepository.find({
      where: { doctorId },
      relations: ['patient', 'dependent'],
    });
  }

  async getAccessRequestsForPatient(patientId: string) {
    return await this.accessRequestRepository.find({
      where: [
        { patientId },
      ],
      relations: ['doctor'],
    });
  }

  async getAccessRequestsForDependents(userId: string) {
    const dependents = await this.dependentRepository
      .createQueryBuilder('dependent')
      .leftJoinAndSelect('dependent.responsibles', 'responsibles')
      .where('responsibles.id = :userId', { userId })
      .getMany();

    const dependentIds = dependents.map((d) => d.id);

    if (dependentIds.length === 0) {
      return [];
    }

    return await this.accessRequestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.doctor', 'doctor')
      .leftJoinAndSelect('request.dependent', 'dependent')
      .where('request.dependentId IN (:...dependentIds)', { dependentIds })
      .getMany();
  }

  async hasPermission(doctorId: string, patientId?: string, dependentId?: string): Promise<boolean> {
    const permission = await this.permissionRepository.findOne({
      where: {
        doctorId,
        patientId,
        dependentId,
        isActive: true,
      },
    });

    return !!permission;
  }
}
