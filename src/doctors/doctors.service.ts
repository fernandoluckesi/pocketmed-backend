import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Dependent } from '../entities/dependent.entity';
import { DoctorAccessRequest, AccessRequestStatus } from '../entities/doctor-access-request.entity';
import { DoctorPermission } from '../entities/doctor-permission.entity';
import { RequestAccessDto } from './dto/request-access.dto';
import { NotificationsService } from '../notifications/notifications.service';

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
    private readonly notificationsService: NotificationsService,
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

    const savedRequest = await this.accessRequestRepository.save(accessRequest);

    // Notify patient about the new access request
    const doctorInfo = await this.doctorRepository.findOne({ where: { id: doctorId } });
    const targetId = dto.patientId || dto.dependentId;
    const targetType = dto.dependentId ? 'dependent' : 'patient';
    if (targetId) {
      this.notificationsService
        .createNotification(
          targetId,
          targetType,
          'Novo pedido de acesso',
          `Dr(a). ${doctorInfo?.name ?? 'Médico'} está solicitando acesso ao seu prontuário.`,
          'ACCESS_REQUEST_CREATED',
          {
            doctorId,
            doctorName: doctorInfo?.name ?? '',
            patientId: dto.patientId ?? null,
            dependentId: dto.dependentId ?? null,
          },
          savedRequest.id,
        )
        .catch(() => {
          /* notification is best-effort */
        });
    }

    return savedRequest;
  }

  async respondToAccessRequest(
    requestId: string,
    status: AccessRequestStatus,
    userId: string,
    userType: string,
  ) {
    const request = await this.accessRequestRepository.findOne({
      where: { id: requestId },
      relations: ['doctor', 'patient', 'dependent', 'dependent.responsibles'],
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

    await this.notificationsService.syncAccessRequestNotificationStatus(request.id, status);

    if (status === AccessRequestStatus.APPROVED) {
      const permission = this.permissionRepository.create({
        doctorId: request.doctorId,
        patientId: request.patientId,
        dependentId: request.dependentId,
        isActive: true,
      });

      await this.permissionRepository.save(permission);
    }

    // Notify doctor about the response
    this.notificationsService
      .createNotification(
        request.doctorId,
        'doctor',
        status === AccessRequestStatus.APPROVED ? 'Acesso autorizado!' : 'Acesso negado',
        status === AccessRequestStatus.APPROVED
          ? `O paciente autorizou o acesso ao prontuário.`
          : `O paciente recusou a solicitação de acesso.`,
        'ACCESS_REQUEST_RESPONDED',
        {
          status,
          patientId: request.patientId ?? null,
          dependentId: request.dependentId ?? null,
        },
        request.id,
      )
      .catch(() => {
        /* notification is best-effort */
      });

    return {
      message: `Access request ${status}`,
      request,
    };
  }

  async cancelAccessRequest(requestId: string, doctorId: string) {
    const request = await this.accessRequestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Access request not found');
    }

    if (request.doctorId !== doctorId) {
      throw new ForbiddenException('You can only cancel your own access requests');
    }

    if (request.status !== AccessRequestStatus.PENDING) {
      throw new BadRequestException('Only pending access requests can be cancelled');
    }

    await this.accessRequestRepository.remove(request);

    return { message: 'Access request cancelled successfully' };
  }

  async getMyAccessRequests(doctorId: string) {
    return await this.accessRequestRepository.find({
      where: { doctorId },
      relations: ['doctor', 'patient', 'dependent'],
    });
  }

  async getAccessRequestsForPatient(patientId: string) {
    return await this.accessRequestRepository.find({
      where: [{ patientId }],
      relations: ['doctor', 'patient', 'dependent'],
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
      .leftJoinAndSelect('request.patient', 'patient')
      .leftJoinAndSelect('request.dependent', 'dependent')
      .where('request.dependentId IN (:...dependentIds)', { dependentIds })
      .getMany();
  }

  async hasPermission(
    doctorId: string,
    patientId?: string,
    dependentId?: string,
  ): Promise<boolean> {
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

  async getPermissionsForPatient(patientId: string) {
    return await this.permissionRepository.find({
      where: { patientId, isActive: true },
      relations: ['doctor'],
      order: { grantedAt: 'DESC' },
    });
  }

  async revokePermission(permissionId: string, userId: string, userType: string) {
    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId },
      relations: ['dependent', 'dependent.responsibles'],
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    if (permission.patientId) {
      if (userType !== 'patient' || permission.patientId !== userId) {
        throw new ForbiddenException('You can only revoke permissions for your own account');
      }
    }

    if (permission.dependentId) {
      if (userType !== 'patient') {
        throw new ForbiddenException('Only patients can revoke dependent permissions');
      }
      const isResponsible = permission.dependent?.responsibles?.some((r) => r.id === userId);
      if (!isResponsible) {
        throw new ForbiddenException('You are not responsible for this dependent');
      }
    }

    permission.isActive = false;
    await this.permissionRepository.save(permission);

    return { message: 'Permission revoked successfully' };
  }
}
