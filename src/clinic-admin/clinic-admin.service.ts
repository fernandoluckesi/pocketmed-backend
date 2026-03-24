import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { DoctorPermission } from '../entities/doctor-permission.entity';
import { ProfessionalRole } from '../auth/professional-role.enum';
import { AddClinicMemberDto } from './dto/add-clinic-member.dto';
import { CreateShadowDoctorByAdminDto } from './dto/create-shadow-doctor-by-admin.dto';
import { EmailService } from '../email/email.service';
import { ListClinicMembersQueryDto } from './dto/list-clinic-members.query.dto';
import { UpdateClinicMemberRoleDto } from './dto/update-clinic-member-role.dto';

@Injectable()
export class ClinicAdminService {
  constructor(
    @InjectRepository(ClinicMembership)
    private clinicMembershipRepository: Repository<ClinicMembership>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(DoctorPermission)
    private doctorPermissionRepository: Repository<DoctorPermission>,
    private emailService: EmailService,
  ) {}

  private getClinicContext(user: any, allowedRoles: ProfessionalRole[]) {
    if (user.type !== 'doctor') {
      throw new ForbiddenException('Only professional accounts can access this resource');
    }

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Current role cannot access this resource');
    }

    if (!user.activeClinicId) {
      throw new ForbiddenException('No active clinic context found for user');
    }

    return {
      userId: String(user.userId),
      role: user.role as ProfessionalRole,
      clinicId: String(user.activeClinicId),
    };
  }

  private getAdminContext(user: any) {
    const context = this.getClinicContext(user, [ProfessionalRole.ADMIN]);
    return {
      adminId: context.userId,
      clinicId: context.clinicId,
    };
  }

  private sanitizeDoctor(doctor: Doctor) {
    const {
      password,
      verificationCode,
      verificationCodeExpiry,
      passwordResetCode,
      passwordResetCodeExpiry,
      ...safeDoctor
    } = doctor as any;

    return safeDoctor;
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async getOverview(user: any) {
    const { clinicId } = this.getAdminContext(user);

    const memberships = await this.clinicMembershipRepository.find({
      where: { clinicId, isActive: true },
      select: ['id', 'professionalId', 'role'],
    });

    const doctorIds = memberships
      .filter((m) => m.role === ProfessionalRole.DOCTOR)
      .map((m) => m.professionalId);

    if (doctorIds.length === 0) {
      return {
        clinicId,
        members: {
          total: memberships.length,
          admins: memberships.filter((m) => m.role === ProfessionalRole.ADMIN).length,
          doctors: 0,
          secretaries: memberships.filter((m) => m.role === ProfessionalRole.SECRETARY).length,
        },
        patients: {
          total: 0,
        },
      };
    }

    const patients = await this.patientRepository
      .createQueryBuilder('patient')
      .distinct(true)
      .leftJoin(
        DoctorPermission,
        'permission',
        'permission.patientId = patient.id AND permission.isActive = :isActive',
        { isActive: true },
      )
      .where('patient.doctorCreatorId IN (:...doctorIds)', { doctorIds })
      .orWhere('permission.doctorId IN (:...doctorIds)', { doctorIds })
      .getCount();

    return {
      clinicId,
      members: {
        total: memberships.length,
        admins: memberships.filter((m) => m.role === ProfessionalRole.ADMIN).length,
        doctors: memberships.filter((m) => m.role === ProfessionalRole.DOCTOR).length,
        secretaries: memberships.filter((m) => m.role === ProfessionalRole.SECRETARY).length,
      },
      patients: {
        total: patients,
      },
    };
  }

  async listMembers(user: any, query: ListClinicMembersQueryDto) {
    const { clinicId } = this.getAdminContext(user);

    const page = Number(query.page || 1);
    const pageSize = Number(query.pageSize || 10);
    const skip = (page - 1) * pageSize;

    const qb = this.clinicMembershipRepository
      .createQueryBuilder('membership')
      .leftJoinAndSelect('membership.professional', 'professional')
      .where('membership.clinicId = :clinicId', { clinicId })
      .andWhere('membership.isActive = :isActive', { isActive: true });

    if (query.role) {
      qb.andWhere('membership.role = :role', { role: query.role });
    }

    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(professional.name) LIKE :search OR LOWER(professional.email) LIKE :search)',
        {
          search,
        },
      );
    }

    const [memberships, total] = await qb
      .orderBy('membership.createdAt', 'ASC')
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    const items = memberships.map((membership) => ({
      id: membership.id,
      role: membership.role,
      isActive: membership.isActive,
      invitedBy: membership.invitedBy,
      createdAt: membership.createdAt,
      professional: membership.professional ? this.sanitizeDoctor(membership.professional) : null,
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateMemberRole(user: any, membershipId: string, dto: UpdateClinicMemberRoleDto) {
    const { clinicId, adminId } = this.getAdminContext(user);

    const membership = await this.clinicMembershipRepository.findOne({
      where: {
        id: membershipId,
        clinicId,
        isActive: true,
      },
      relations: ['professional'],
    });

    if (!membership) {
      throw new NotFoundException('Membership not found in active clinic');
    }

    if (membership.professionalId === adminId && dto.role !== ProfessionalRole.ADMIN) {
      const activeAdmins = await this.clinicMembershipRepository.count({
        where: {
          clinicId,
          role: ProfessionalRole.ADMIN,
          isActive: true,
        },
      });

      if (activeAdmins <= 1) {
        throw new BadRequestException('Cannot remove admin role from the last active clinic admin');
      }
    }

    membership.role = dto.role;
    const updated = await this.clinicMembershipRepository.save(membership);

    return {
      id: updated.id,
      role: updated.role,
      isActive: updated.isActive,
      invitedBy: updated.invitedBy,
      createdAt: updated.createdAt,
      professional: updated.professional ? this.sanitizeDoctor(updated.professional) : null,
    };
  }

  async addMember(user: any, dto: AddClinicMemberDto) {
    const { clinicId, adminId } = this.getAdminContext(user);

    const normalizedEmail = dto.professionalEmail.trim().toLowerCase();
    const doctor = await this.doctorRepository.findOne({ where: { email: normalizedEmail } });

    if (!doctor) {
      throw new NotFoundException('Professional not found with this email');
    }

    const existingMembership = await this.clinicMembershipRepository.findOne({
      where: {
        clinicId,
        professionalId: doctor.id,
      },
    });

    if (existingMembership?.isActive) {
      throw new ConflictException('Professional is already an active member of this clinic');
    }

    if (existingMembership) {
      existingMembership.role = dto.role;
      existingMembership.isActive = true;
      existingMembership.invitedBy = adminId;
      const reactivated = await this.clinicMembershipRepository.save(existingMembership);
      return {
        id: reactivated.id,
        role: reactivated.role,
        isActive: reactivated.isActive,
        professional: this.sanitizeDoctor(doctor),
      };
    }

    const membership = this.clinicMembershipRepository.create({
      clinicId,
      professionalId: doctor.id,
      role: dto.role,
      isActive: true,
      invitedBy: adminId,
    });

    const saved = await this.clinicMembershipRepository.save(membership);

    return {
      id: saved.id,
      role: saved.role,
      isActive: saved.isActive,
      professional: this.sanitizeDoctor(doctor),
    };
  }

  async removeMember(user: any, membershipId: string) {
    const { clinicId, adminId } = this.getAdminContext(user);

    const membership = await this.clinicMembershipRepository.findOne({
      where: { id: membershipId, clinicId },
      relations: ['professional'],
    });

    if (!membership) {
      throw new NotFoundException('Membership not found in active clinic');
    }

    if (!membership.isActive) {
      throw new BadRequestException('Membership is already inactive');
    }

    if (membership.professionalId === adminId && membership.role === ProfessionalRole.ADMIN) {
      const activeAdmins = await this.clinicMembershipRepository.count({
        where: {
          clinicId,
          role: ProfessionalRole.ADMIN,
          isActive: true,
        },
      });

      if (activeAdmins <= 1) {
        throw new BadRequestException('Cannot remove the last active clinic admin');
      }
    }

    membership.isActive = false;
    await this.clinicMembershipRepository.save(membership);

    return {
      message: 'Clinic member removed successfully',
      id: membership.id,
    };
  }

  async createShadowDoctor(user: any, dto: CreateShadowDoctorByAdminDto) {
    const { clinicId, adminId } = this.getAdminContext(user);

    const normalizedEmail = dto.email.trim().toLowerCase();

    const existingDoctor = await this.doctorRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existingDoctor) {
      throw new ConflictException('Email already registered');
    }

    const existingPatient = await this.patientRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existingPatient) {
      throw new ConflictException('Email already registered');
    }

    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const doctor = this.doctorRepository.create({
      name: dto.name,
      email: normalizedEmail,
      gender: dto.gender,
      specialty: dto.specialty,
      cpf: dto.cpf,
      phone: dto.phone,
      birthDate: new Date(dto.birthDate),
      crm: dto.crm,
      profileImage: dto.profileImage || null,
      type: 'doctor',
      isShadow: true,
      verificationCode,
      verificationCodeExpiry,
    });

    const savedDoctor = await this.doctorRepository.save(doctor);

    const membership = this.clinicMembershipRepository.create({
      clinicId,
      professionalId: savedDoctor.id,
      role: ProfessionalRole.DOCTOR,
      isActive: true,
      invitedBy: adminId,
    });

    await this.clinicMembershipRepository.save(membership);

    await this.emailService.sendVerificationCode(normalizedEmail, verificationCode, dto.name);

    return {
      message: 'Shadow doctor created successfully. Verification code sent to email.',
      user: {
        ...this.sanitizeDoctor(savedDoctor),
        role: ProfessionalRole.DOCTOR,
        activeClinicId: clinicId,
      },
    };
  }

  async listClinicPatients(user: any) {
    const { clinicId, role } = this.getClinicContext(user, [
      ProfessionalRole.ADMIN,
      ProfessionalRole.SECRETARY,
    ]);

    const doctorMemberships = await this.clinicMembershipRepository.find({
      where: {
        clinicId,
        isActive: true,
        role: ProfessionalRole.DOCTOR,
      },
      select: ['professionalId'],
    });

    const doctorIds = doctorMemberships.map((m) => m.professionalId);

    if (doctorIds.length === 0) {
      return [];
    }

    const patients = await this.patientRepository
      .createQueryBuilder('patient')
      .select([
        'patient.id',
        'patient.name',
        'patient.email',
        'patient.gender',
        'patient.phone',
        'patient.birthDate',
        'patient.profileImage',
        'patient.type',
        'patient.isShadow',
        'patient.doctorCreatorId',
        'patient.createdAt',
        'patient.updatedAt',
      ])
      .distinct(true)
      .leftJoin(
        DoctorPermission,
        'permission',
        'permission.patientId = patient.id AND permission.isActive = :isActive',
        { isActive: true },
      )
      .where('patient.doctorCreatorId IN (:...doctorIds)', { doctorIds })
      .orWhere('permission.doctorId IN (:...doctorIds)', { doctorIds })
      .getMany();

    const doctors = await this.doctorRepository.find({
      where: { id: In(doctorIds) },
      select: ['id', 'name', 'email', 'specialty', 'crm'],
    });

    const doctorsById = new Map(doctors.map((doctor) => [doctor.id, doctor]));

    const permissions = await this.doctorPermissionRepository.find({
      where: {
        doctorId: In(doctorIds),
        isActive: true,
      },
      select: ['doctorId', 'patientId'],
    });

    const patientDoctorsMap = new Map<string, Set<string>>();
    for (const permission of permissions) {
      if (!permission.patientId) continue;
      if (!patientDoctorsMap.has(permission.patientId)) {
        patientDoctorsMap.set(permission.patientId, new Set<string>());
      }
      patientDoctorsMap.get(permission.patientId)?.add(permission.doctorId);
    }

    return patients.map((patient) => {
      const linkedDoctorIds = new Set<string>(
        Array.from(patientDoctorsMap.get(patient.id) || new Set<string>()),
      );

      if (patient.doctorCreatorId && doctorIds.includes(patient.doctorCreatorId)) {
        linkedDoctorIds.add(patient.doctorCreatorId);
      }

      const linkedDoctors = Array.from(linkedDoctorIds)
        .map((doctorId) => doctorsById.get(doctorId))
        .filter(Boolean)
        .map((doctor) => ({
          id: doctor.id,
          name: doctor.name,
          email: doctor.email,
          specialty: doctor.specialty,
          crm: doctor.crm,
        }));

      if (role === ProfessionalRole.SECRETARY) {
        return {
          id: patient.id,
          name: patient.name,
          email: patient.email,
          linkedDoctors,
          hasAccess: false,
          hasPermission: false,
        };
      }

      return {
        ...patient,
        linkedDoctors,
      };
    });
  }

  async listClinicDoctors(user: any) {
    const { clinicId } = this.getClinicContext(user, [
      ProfessionalRole.ADMIN,
      ProfessionalRole.SECRETARY,
    ]);

    const memberships = await this.clinicMembershipRepository.find({
      where: {
        clinicId,
        isActive: true,
        role: ProfessionalRole.DOCTOR,
      },
      select: ['professionalId'],
    });

    const doctorIds = memberships.map((membership) => membership.professionalId);
    if (doctorIds.length === 0) {
      return [];
    }

    const doctors = await this.doctorRepository.find({
      where: { id: In(doctorIds) },
      select: ['id', 'name', 'email', 'specialty', 'crm'],
      order: { name: 'ASC' },
    });

    return doctors;
  }
}
