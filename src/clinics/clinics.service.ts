import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Clinic } from '../entities/clinic.entity';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { Doctor } from '../entities/doctor.entity';
import { ProfessionalRole } from '../auth/professional-role.enum';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { UploadService } from '../upload/upload.service';
import { EmailService } from '../email/email.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic)
    private clinicRepository: Repository<Clinic>,
    @InjectRepository(ClinicMembership)
    private clinicMembershipRepository: Repository<ClinicMembership>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    private dataSource: DataSource,
    private uploadService: UploadService,
    private emailService: EmailService,
    private jwtService: JwtService,
  ) {}

  /**
   * Creates a new clinic + doctor admin in a single transaction (public endpoint).
   * Same data as doctor registration + clinic fields.
   */
  async create(dto: CreateClinicDto, file?: Express.Multer.File) {
    // ── Validate uniqueness ─────────────────────────────────────────────────
    const conflicts: string[] = [];

    const existingEmail = await this.doctorRepository.findOne({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (existingEmail) conflicts.push('email');

    const existingPhone = await this.doctorRepository.findOne({
      where: { phone: dto.phone },
    });
    if (existingPhone) conflicts.push('phone');

    const existingCrm = await this.doctorRepository.findOne({
      where: { crm: dto.crm },
    });
    if (existingCrm) conflicts.push('crm');

    if (conflicts.length > 0) {
      throw new ConflictException({
        message: 'Dados já cadastrados',
        conflicts,
      });
    }

    // Check CNPJ uniqueness
    if (dto.cnpj) {
      const existingCnpj = await this.clinicRepository.findOne({
        where: { cnpj: dto.cnpj },
      });
      if (existingCnpj) {
        throw new ConflictException({
          message: 'CNPJ já cadastrado para outra clínica',
          conflicts: ['cnpj'],
        });
      }
    }

    // ── Upload profile image ────────────────────────────────────────────────
    let profileImageUrl: string | null = null;
    if (file) {
      try {
        const uploadedUrl = await this.uploadService.uploadFile(file, 'profiles');
        profileImageUrl = uploadedUrl || null;
      } catch (uploadError) {
        console.warn('Profile image upload failed, continuing without image:', uploadError.message);
        profileImageUrl = null;
      }
    }

    // ── Transaction: create doctor + clinic + membership ────────────────────
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create doctor
      const doctor = queryRunner.manager.create(Doctor, {
        name: dto.name,
        email: dto.email.trim().toLowerCase(),
        password: hashedPassword,
        gender: dto.gender,
        specialty: dto.specialty,
        cpf: dto.cpf,
        phone: dto.phone,
        birthDate: new Date(dto.birthDate),
        crm: dto.crm,
        rqe: dto.rqe || null,
        profileImage: profileImageUrl,
        type: 'doctor',
        isShadow: false,
        emailVerified: false,
      });
      const savedDoctor = await queryRunner.manager.save(doctor);

      // 2. Create clinic
      const clinic = queryRunner.manager.create(Clinic, {
        name: dto.clinicName.trim(),
        cnpj: dto.cnpj || null,
        isActive: true,
        cep: dto.cep || null,
        street: dto.street || null,
        number: dto.noNumber ? null : dto.number || null,
        complement: dto.complement || null,
        neighborhood: dto.neighborhood || null,
        city: dto.city || null,
        state: dto.state || null,
        noNumber: dto.noNumber ?? false,
      });
      const savedClinic = await queryRunner.manager.save(clinic);

      // 3. Create membership (doctor as admin)
      const membership = queryRunner.manager.create(ClinicMembership, {
        clinicId: savedClinic.id,
        professionalId: savedDoctor.id,
        role: ProfessionalRole.ADMIN,
        isActive: true,
        invitedBy: null,
      });
      await queryRunner.manager.save(membership);

      // 4. Send email verification
      const verificationCode = this.generateVerificationCode();
      savedDoctor.verificationCode = verificationCode;
      savedDoctor.verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
      await queryRunner.manager.save(savedDoctor);
      await this.emailService.sendEmailVerificationCode(
        dto.email.trim().toLowerCase(),
        verificationCode,
        dto.name,
      );

      await queryRunner.commitTransaction();

      // Generate JWT token
      const token = this.jwtService.sign({
        sub: savedDoctor.id,
        email: savedDoctor.email,
        type: 'doctor',
        role: ProfessionalRole.ADMIN,
        activeClinicId: savedClinic.id,
      });

      return {
        message: 'Clinic and admin account created successfully',
        user: this.sanitizeDoctor(savedDoctor),
        clinic: {
          id: savedClinic.id,
          name: savedClinic.name,
          cnpj: savedClinic.cnpj,
          isActive: savedClinic.isActive,
          cep: savedClinic.cep,
          street: savedClinic.street,
          number: savedClinic.number,
          complement: savedClinic.complement,
          neighborhood: savedClinic.neighborhood,
          city: savedClinic.city,
          state: savedClinic.state,
          noNumber: savedClinic.noNumber,
        },
        token,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Returns all clinics the authenticated doctor belongs to.
   */
  async findMyClinic(user: any) {
    if (user.type !== 'doctor') {
      throw new ForbiddenException('Only professional accounts can access clinics');
    }

    const memberships = await this.clinicMembershipRepository.find({
      where: { professionalId: user.userId, isActive: true },
      relations: ['clinic'],
      order: { createdAt: 'ASC' },
    });

    return memberships.map((m) => ({
      clinicId: m.clinic.id,
      name: m.clinic.name,
      cnpj: m.clinic.cnpj,
      isActive: m.clinic.isActive,
      role: m.role,
      membershipId: m.id,
      joinedAt: m.createdAt,
    }));
  }

  /**
   * Get a specific clinic by ID (must be a member).
   */
  async findOne(id: string, user: any) {
    if (user.type !== 'doctor') {
      throw new ForbiddenException('Only professional accounts can access clinics');
    }

    const membership = await this.clinicMembershipRepository.findOne({
      where: { clinicId: id, professionalId: user.userId, isActive: true },
      relations: ['clinic'],
    });

    if (!membership) {
      throw new NotFoundException('Clinic not found or you are not a member');
    }

    return {
      clinic: membership.clinic,
      role: membership.role,
      membershipId: membership.id,
    };
  }

  /**
   * Updates a clinic (admin only).
   */
  async update(id: string, dto: UpdateClinicDto, user: any) {
    if (user.type !== 'doctor') {
      throw new ForbiddenException('Only professional accounts can update clinics');
    }

    const membership = await this.clinicMembershipRepository.findOne({
      where: { clinicId: id, professionalId: user.userId, isActive: true },
    });

    if (!membership) {
      throw new NotFoundException('Clinic not found or you are not a member');
    }

    if (membership.role !== ProfessionalRole.ADMIN) {
      throw new ForbiddenException('Only clinic admins can update clinic data');
    }

    const clinic = await this.clinicRepository.findOne({ where: { id } });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    // Check CNPJ uniqueness if changing
    if (dto.cnpj && dto.cnpj !== clinic.cnpj) {
      const existingCnpj = await this.clinicRepository.findOne({
        where: { cnpj: dto.cnpj },
      });
      if (existingCnpj && existingCnpj.id !== id) {
        throw new ConflictException('CNPJ already registered for another clinic');
      }
    }

    if (dto.name !== undefined) clinic.name = dto.name.trim();
    if (dto.cnpj !== undefined) clinic.cnpj = dto.cnpj;
    if (dto.isActive !== undefined) clinic.isActive = dto.isActive;

    const updatedClinic = await this.clinicRepository.save(clinic);

    return {
      message: 'Clinic updated successfully',
      clinic: updatedClinic,
    };
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
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
}
