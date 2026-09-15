import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { Clinic } from '../entities/clinic.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { DoctorPermission } from '../entities/doctor-permission.entity';
import { ClinicAdminProfile } from '../entities/clinic-admin-profile.entity';
import { SecretaryProfile } from '../entities/secretary-profile.entity';
import { ProfessionalRole } from '../auth/professional-role.enum';
import { AddClinicMemberDto } from './dto/add-clinic-member.dto';
import { CreateShadowDoctorByAdminDto } from './dto/create-shadow-doctor-by-admin.dto';
import { EmailService } from '../email/email.service';
import { ListClinicMembersQueryDto } from './dto/list-clinic-members.query.dto';
import { UpdateClinicMemberRoleDto } from './dto/update-clinic-member-role.dto';
import { UpdateRoleProfileDto } from './dto/update-role-profile.dto';

@Injectable()
export class ClinicAdminService {
  constructor(
    @InjectRepository(ClinicMembership)
    private clinicMembershipRepository: Repository<ClinicMembership>,
    @InjectRepository(Clinic)
    private clinicRepository: Repository<Clinic>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(DoctorPermission)
    private doctorPermissionRepository: Repository<DoctorPermission>,
    @InjectRepository(ClinicAdminProfile)
    private clinicAdminProfileRepository: Repository<ClinicAdminProfile>,
    @InjectRepository(SecretaryProfile)
    private secretaryProfileRepository: Repository<SecretaryProfile>,
    private emailService: EmailService,
  ) {}

  private applyProfessionalDataToRoleProfile(
    profile: ClinicAdminProfile | SecretaryProfile,
    doctor: Doctor,
    clinicId: string | null,
  ) {
    profile.professionalId = doctor.id;
    profile.clinicId = clinicId;
    profile.name = doctor.name;
    profile.email = doctor.email;
    profile.password = doctor.password || null;
    profile.phone = doctor.phone;
    profile.profileImage = doctor.profileImage || null;
    profile.gender = doctor.gender || null;
    profile.birthDate = doctor.birthDate || null;
    profile.cpf = doctor.cpf || null;
  }

  private async syncRoleProfiles(professionalId: string) {
    const professional = await this.doctorRepository.findOne({
      where: { id: professionalId },
    });

    if (!professional) {
      await this.clinicAdminProfileRepository.delete({ professionalId });
      await this.secretaryProfileRepository.delete({ professionalId });
      return;
    }

    const activeMemberships = await this.clinicMembershipRepository.find({
      where: {
        professionalId,
        isActive: true,
      },
      order: { createdAt: 'ASC' },
    });

    const adminMembership = activeMemberships.find((m) => m.role === ProfessionalRole.ADMIN);
    const secretaryMembership = activeMemberships.find(
      (m) => m.role === ProfessionalRole.SECRETARY,
    );

    if (adminMembership) {
      const existingAdminProfile = await this.clinicAdminProfileRepository.findOne({
        where: { professionalId },
      });

      if (existingAdminProfile) {
        this.applyProfessionalDataToRoleProfile(
          existingAdminProfile,
          professional,
          adminMembership.clinicId,
        );
        await this.clinicAdminProfileRepository.save(existingAdminProfile);
      } else {
        const createdAdminProfile = this.clinicAdminProfileRepository.create();
        this.applyProfessionalDataToRoleProfile(
          createdAdminProfile,
          professional,
          adminMembership.clinicId,
        );
        await this.clinicAdminProfileRepository.save(createdAdminProfile);
      }
    } else {
      await this.clinicAdminProfileRepository.delete({ professionalId });
    }

    if (secretaryMembership) {
      const existingSecretaryProfile = await this.secretaryProfileRepository.findOne({
        where: { professionalId },
      });

      if (existingSecretaryProfile) {
        this.applyProfessionalDataToRoleProfile(
          existingSecretaryProfile,
          professional,
          secretaryMembership.clinicId,
        );
        await this.secretaryProfileRepository.save(existingSecretaryProfile);
      } else {
        const createdSecretaryProfile = this.secretaryProfileRepository.create();
        this.applyProfessionalDataToRoleProfile(
          createdSecretaryProfile,
          professional,
          secretaryMembership.clinicId,
        );
        await this.secretaryProfileRepository.save(createdSecretaryProfile);
      }
    } else {
      await this.secretaryProfileRepository.delete({ professionalId });
    }
  }

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

  private sanitizeRoleProfile(profile: ClinicAdminProfile | SecretaryProfile) {
    const { password, ...safeProfile } = profile as any;
    return safeProfile;
  }

  private async ensureUniqueProfileEmail(
    email: string,
    currentProfileId: string,
    role: ProfessionalRole,
  ) {
    const normalizedEmail = email.trim().toLowerCase();

    const adminWithEmail = await this.clinicAdminProfileRepository.findOne({
      where: { email: normalizedEmail },
      select: ['id'],
    });
    if (adminWithEmail && adminWithEmail.id !== currentProfileId) {
      throw new ConflictException('Email already in use by another clinic admin profile');
    }

    const secretaryWithEmail = await this.secretaryProfileRepository.findOne({
      where: { email: normalizedEmail },
      select: ['id'],
    });
    if (secretaryWithEmail && secretaryWithEmail.id !== currentProfileId) {
      throw new ConflictException('Email already in use by another secretary profile');
    }

    const professionalWithEmail = await this.doctorRepository.findOne({
      where: { email: normalizedEmail },
      select: ['id'],
    });
    if (professionalWithEmail) {
      const currentProfile =
        role === ProfessionalRole.ADMIN
          ? await this.clinicAdminProfileRepository.findOne({ where: { id: currentProfileId } })
          : await this.secretaryProfileRepository.findOne({ where: { id: currentProfileId } });

      if (
        !currentProfile?.professionalId ||
        professionalWithEmail.id !== currentProfile.professionalId
      ) {
        throw new ConflictException('Email already in use by another professional');
      }
    }
  }

  private async applyRoleProfileUpdate(
    profile: ClinicAdminProfile | SecretaryProfile,
    dto: UpdateRoleProfileDto,
    role: ProfessionalRole,
  ) {
    if (dto.email) {
      await this.ensureUniqueProfileEmail(dto.email, profile.id, role);
      profile.email = dto.email.trim().toLowerCase();
    }

    if (dto.name) {
      profile.name = dto.name.trim();
    }

    if (dto.phone) {
      profile.phone = dto.phone.trim();
    }

    if (dto.password) {
      profile.password = await bcrypt.hash(dto.password, 10);
    }
  }

  private async syncRoleProfileToProfessional(profile: ClinicAdminProfile | SecretaryProfile) {
    if (!profile.professionalId) {
      return;
    }

    const professional = await this.doctorRepository.findOne({
      where: { id: profile.professionalId },
    });
    if (!professional) {
      return;
    }

    professional.name = profile.name;
    professional.email = profile.email || professional.email;
    professional.phone = profile.phone;
    if (profile.password) {
      professional.password = profile.password;
    }

    await this.doctorRepository.save(professional);
  }

  async getOverview(user: any) {
    const { clinicId } = this.getAdminContext(user);

    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
      select: ['id', 'name'],
    });

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
        clinicName: clinic?.name || null,
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
      clinicName: clinic?.name || null,
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
    await this.syncRoleProfiles(updated.professionalId);

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

    if (dto.role === ProfessionalRole.DOCTOR) {
      let doctor: Doctor | null = null;

      if (dto.professionalId) {
        doctor = await this.doctorRepository.findOne({ where: { id: dto.professionalId } });
      }

      if (!doctor && dto.professionalEmail) {
        const normalizedEmail = dto.professionalEmail.trim().toLowerCase();
        doctor = await this.doctorRepository.findOne({ where: { email: normalizedEmail } });
      }

      if (!doctor) {
        throw new NotFoundException('Doctor not found with provided data');
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
        existingMembership.role = ProfessionalRole.DOCTOR;
        existingMembership.isActive = true;
        existingMembership.invitedBy = adminId;
        const reactivated = await this.clinicMembershipRepository.save(existingMembership);
        await this.syncRoleProfiles(reactivated.professionalId);
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
        role: ProfessionalRole.DOCTOR,
        isActive: true,
        invitedBy: adminId,
      });

      const saved = await this.clinicMembershipRepository.save(membership);
      await this.syncRoleProfiles(saved.professionalId);

      return {
        id: saved.id,
        role: saved.role,
        isActive: saved.isActive,
        professional: this.sanitizeDoctor(doctor),
      };
    }

    if (dto.role === ProfessionalRole.SECRETARY) {
      if (!dto.name?.trim() || !dto.email?.trim() || !dto.phone?.trim()) {
        throw new BadRequestException('For secretary, name, email and phone are required');
      }

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

      const existingAdminProfile = await this.clinicAdminProfileRepository.findOne({
        where: { email: normalizedEmail },
      });
      if (existingAdminProfile) {
        throw new ConflictException('Email already registered');
      }

      const existingSecretaryProfile = await this.secretaryProfileRepository.findOne({
        where: { email: normalizedEmail },
      });
      if (existingSecretaryProfile) {
        throw new ConflictException('Email already registered');
      }

      const verificationCode = this.generateVerificationCode();
      const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
      const suffix = Date.now().toString().slice(-8);

      const shadowSecretary = this.doctorRepository.create({
        name: dto.name.trim(),
        email: normalizedEmail,
        phone: dto.phone.trim(),
        gender: 'not_informed',
        birthDate: new Date('1990-01-01'),
        specialty: 'Secretaria',
        crm: `SEC${suffix}`,
        cpf: `000.000.${suffix.slice(0, 3)}-${suffix.slice(3, 5)}`,
        profileImage: null,
        type: 'doctor',
        isShadow: true,
        password: null,
        verificationCode,
        verificationCodeExpiry,
      });

      const savedSecretaryProfessional = await this.doctorRepository.save(shadowSecretary);

      const membership = this.clinicMembershipRepository.create({
        clinicId,
        professionalId: savedSecretaryProfessional.id,
        role: ProfessionalRole.SECRETARY,
        isActive: true,
        invitedBy: adminId,
      });

      const savedMembership = await this.clinicMembershipRepository.save(membership);
      await this.syncRoleProfiles(savedMembership.professionalId);

      await this.emailService.sendVerificationCode(
        normalizedEmail,
        verificationCode,
        savedSecretaryProfessional.name,
      );

      return {
        id: savedMembership.id,
        role: savedMembership.role,
        isActive: savedMembership.isActive,
        professional: this.sanitizeDoctor(savedSecretaryProfessional),
        message:
          'Secretary created successfully. Verification code sent to email for first access.',
      };
    }

    throw new BadRequestException('Only doctor and secretary roles can be added here');
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
    const updatedMembership = await this.clinicMembershipRepository.save(membership);
    await this.syncRoleProfiles(updatedMembership.professionalId);

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

    // Admins are also physicians who see patients, so they must appear in the
    // schedulable doctors list alongside members with the plain "doctor" role.
    const memberships = await this.clinicMembershipRepository.find({
      where: {
        clinicId,
        isActive: true,
        role: In([ProfessionalRole.DOCTOR, ProfessionalRole.ADMIN]),
      },
      select: ['professionalId'],
    });

    const doctorIds = [...new Set(memberships.map((membership) => membership.professionalId))];
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

  async searchDoctors(user: any, query: string) {
    const { clinicId } = this.getAdminContext(user);
    const normalizedQuery = String(query || '')
      .trim()
      .toLowerCase();

    if (normalizedQuery.length < 2) {
      return [];
    }

    const onlyDigits = normalizedQuery.replace(/\D/g, '');

    const doctorsQb = this.doctorRepository
      .createQueryBuilder('doctor')
      .select([
        'doctor.id',
        'doctor.name',
        'doctor.email',
        'doctor.gender',
        'doctor.specialty',
        'doctor.crm',
        'doctor.cpf',
        'doctor.phone',
        'doctor.birthDate',
        'doctor.profileImage',
        'doctor.type',
      ])
      .where('LOWER(doctor.name) LIKE :query', { query: `%${normalizedQuery}%` })
      .orWhere('LOWER(doctor.email) LIKE :query', { query: `%${normalizedQuery}%` })
      .orderBy('doctor.name', 'ASC')
      .take(20);

    if (onlyDigits) {
      doctorsQb.orWhere('doctor.cpf LIKE :cpf', { cpf: `%${onlyDigits}%` });
    }

    const doctors = await doctorsQb.getMany();
    if (doctors.length === 0) {
      return [];
    }

    const doctorIds = doctors.map((doctor) => doctor.id);
    const activeMemberships = await this.clinicMembershipRepository.find({
      where: {
        clinicId,
        isActive: true,
        professionalId: In(doctorIds),
      },
      select: ['professionalId'],
    });

    const clinicMemberIds = new Set(
      activeMemberships.map((membership) => membership.professionalId),
    );

    return doctors.map((doctor) => ({
      ...this.sanitizeDoctor(doctor),
      isClinicMember: clinicMemberIds.has(doctor.id),
    }));
  }

  async findDoctorByEmail(user: any, email: string) {
    const { clinicId } = this.getAdminContext(user);
    const normalizedEmail = String(email || '')
      .trim()
      .toLowerCase();

    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    const doctor = await this.doctorRepository.findOne({
      where: { email: normalizedEmail },
      select: [
        'id',
        'name',
        'email',
        'gender',
        'specialty',
        'crm',
        'cpf',
        'phone',
        'birthDate',
        'profileImage',
        'type',
      ],
    });

    if (!doctor) {
      return null;
    }

    const membership = await this.clinicMembershipRepository.findOne({
      where: {
        clinicId,
        professionalId: doctor.id,
        isActive: true,
      },
      select: ['id'],
    });

    return {
      ...this.sanitizeDoctor(doctor),
      isClinicMember: Boolean(membership),
    };
  }

  async listAdminProfiles(user: any) {
    const { clinicId } = this.getAdminContext(user);

    const profiles = await this.clinicAdminProfileRepository.find({
      where: { clinicId },
      order: { createdAt: 'ASC' },
    });

    return profiles.map((profile) => this.sanitizeRoleProfile(profile));
  }

  async getAdminProfile(user: any, profileId: string) {
    const { clinicId } = this.getAdminContext(user);

    const profile = await this.clinicAdminProfileRepository.findOne({
      where: { id: profileId, clinicId },
    });

    if (!profile) {
      throw new NotFoundException('Clinic admin profile not found in active clinic');
    }

    return this.sanitizeRoleProfile(profile);
  }

  async updateAdminProfile(user: any, profileId: string, dto: UpdateRoleProfileDto) {
    const { clinicId } = this.getAdminContext(user);

    const profile = await this.clinicAdminProfileRepository.findOne({
      where: { id: profileId, clinicId },
    });

    if (!profile) {
      throw new NotFoundException('Clinic admin profile not found in active clinic');
    }

    await this.applyRoleProfileUpdate(profile, dto, ProfessionalRole.ADMIN);
    const saved = await this.clinicAdminProfileRepository.save(profile);
    await this.syncRoleProfileToProfessional(saved);

    return this.sanitizeRoleProfile(saved);
  }

  async deleteAdminProfile(user: any, profileId: string) {
    const { clinicId, adminId } = this.getAdminContext(user);

    const profile = await this.clinicAdminProfileRepository.findOne({
      where: { id: profileId, clinicId },
    });

    if (!profile) {
      throw new NotFoundException('Clinic admin profile not found in active clinic');
    }

    if (profile.professionalId === adminId) {
      throw new BadRequestException('You cannot delete your own admin profile');
    }

    await this.clinicAdminProfileRepository.delete({ id: profile.id });

    return {
      message: 'Clinic admin profile deleted successfully',
      id: profile.id,
    };
  }

  async listSecretaryProfiles(user: any) {
    const { clinicId } = this.getAdminContext(user);

    const profiles = await this.secretaryProfileRepository.find({
      where: { clinicId },
      order: { createdAt: 'ASC' },
    });

    return profiles.map((profile) => this.sanitizeRoleProfile(profile));
  }

  async getSecretaryProfile(user: any, profileId: string) {
    const { clinicId } = this.getAdminContext(user);

    const profile = await this.secretaryProfileRepository.findOne({
      where: { id: profileId, clinicId },
    });

    if (!profile) {
      throw new NotFoundException('Secretary profile not found in active clinic');
    }

    return this.sanitizeRoleProfile(profile);
  }

  async updateSecretaryProfile(user: any, profileId: string, dto: UpdateRoleProfileDto) {
    const { clinicId } = this.getAdminContext(user);

    const profile = await this.secretaryProfileRepository.findOne({
      where: { id: profileId, clinicId },
    });

    if (!profile) {
      throw new NotFoundException('Secretary profile not found in active clinic');
    }

    await this.applyRoleProfileUpdate(profile, dto, ProfessionalRole.SECRETARY);
    const saved = await this.secretaryProfileRepository.save(profile);
    await this.syncRoleProfileToProfessional(saved);

    return this.sanitizeRoleProfile(saved);
  }

  async deleteSecretaryProfile(user: any, profileId: string) {
    const { clinicId } = this.getAdminContext(user);

    const profile = await this.secretaryProfileRepository.findOne({
      where: { id: profileId, clinicId },
    });

    if (!profile) {
      throw new NotFoundException('Secretary profile not found in active clinic');
    }

    await this.secretaryProfileRepository.delete({ id: profile.id });

    return {
      message: 'Secretary profile deleted successfully',
      id: profile.id,
    };
  }
}
