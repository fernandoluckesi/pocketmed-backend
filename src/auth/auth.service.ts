import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Patient } from '../entities/patient.entity';
import { Doctor } from '../entities/doctor.entity';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { RegisterDoctorDto } from './dto/register-doctor.dto';
import { RegisterPatientShadowDto } from './dto/register-patient-shadow.dto';
import { LoginDto } from './dto/login.dto';
import { UploadService } from '../upload/upload.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditResourceType } from '../audit/audit.constants';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { ClinicAdminProfile } from '../entities/clinic-admin-profile.entity';
import { Secretary } from '../entities/secretary.entity';
import { ProfessionalRole } from './professional-role.enum';

type AuthUser = Patient | Doctor;

type DoctorAuthContext = {
  role: ProfessionalRole;
  activeClinicId: string | null;
};

type LoginUser = AuthUser | ClinicAdminProfile | Secretary;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(ClinicMembership)
    private clinicMembershipRepository: Repository<ClinicMembership>,
    @InjectRepository(ClinicAdminProfile)
    private clinicAdminProfileRepository: Repository<ClinicAdminProfile>,
    @InjectRepository(Secretary)
    private secretaryRepository: Repository<Secretary>,
    private jwtService: JwtService,
    private uploadService: UploadService,
    private emailService: EmailService,
    private auditService: AuditService,
    private dataSource: DataSource,
  ) {}

  async registerPatient(dto: RegisterPatientDto, file?: Express.Multer.File) {
    // Only check for active (non-shadow) accounts with same email in PATIENTS table
    const existingActive = await this.patientRepository.findOne({
      where: { email: dto.email, isShadow: false },
    });
    if (existingActive) {
      throw new ConflictException('Email already registered');
    }

    let profileImageUrl = null;
    if (file) {
      try {
        const uploadedUrl = await this.uploadService.uploadFile(file, 'profiles');
        profileImageUrl = uploadedUrl || null;
      } catch (uploadError) {
        console.warn('Profile image upload failed, continuing without image:', uploadError.message);
        profileImageUrl = null;
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const patient = queryRunner.manager.create(Patient, {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        gender: dto.gender,
        phone: dto.phone,
        birthDate: new Date(dto.birthDate),
        profileImage: profileImageUrl,
        type: 'patient',
        isShadow: false,
        emailVerified: false,
      });

      const savedPatient = await queryRunner.manager.save(patient);

      // Send email verification code
      const verificationCode = this.generateVerificationCode();
      savedPatient.verificationCode = verificationCode;
      savedPatient.verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
      await queryRunner.manager.save(savedPatient);
      await this.emailService.sendEmailVerificationCode(dto.email, verificationCode, dto.name);

      await queryRunner.commitTransaction();

      const token = await this.generateToken(savedPatient);

      return {
        user: this.sanitizeUser(savedPatient),
        token,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async registerPatientShadow(
    dto: RegisterPatientShadowDto,
    file?: Express.Multer.File,
    requester?: {
      userId: string;
      type: string;
      role?: string | null;
      activeClinicId?: string | null;
    },
  ) {
    const doctor = await this.doctorRepository.findOne({
      where: { id: dto.doctorCreatorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (!requester || requester.type !== 'doctor') {
      throw new UnauthorizedException('Only professional accounts can create shadow patients');
    }

    if (requester.role === ProfessionalRole.DOCTOR && requester.userId !== dto.doctorCreatorId) {
      throw new UnauthorizedException('Doctors can only create shadow patients for themselves');
    }

    if (
      requester.role === ProfessionalRole.ADMIN ||
      requester.role === ProfessionalRole.SECRETARY
    ) {
      if (!requester.activeClinicId) {
        throw new UnauthorizedException('Active clinic context is required for this operation');
      }

      const clinicDoctorMembership = await this.clinicMembershipRepository.findOne({
        where: {
          clinicId: requester.activeClinicId,
          professionalId: dto.doctorCreatorId,
          role: ProfessionalRole.DOCTOR,
          isActive: true,
        },
      });

      if (!clinicDoctorMembership) {
        throw new UnauthorizedException('Selected doctor is not an active member of your clinic');
      }
    }

    // Only block if there's an active (non-shadow) account with this email
    const existingActive = await this.patientRepository.findOne({
      where: { email: dto.email, isShadow: false },
    });
    if (existingActive) {
      throw new ConflictException('Email already registered to an active account');
    }
    const existingDoctor = await this.doctorRepository.findOne({
      where: { email: dto.email, isShadow: false },
    });
    if (existingDoctor) {
      throw new ConflictException('Email already registered to a doctor account');
    }
    // Shadows with same email are allowed (will be merged on activation)

    let profileImageUrl = null;
    if (file) {
      try {
        const uploadedUrl = await this.uploadService.uploadFile(file, 'profiles');
        profileImageUrl = uploadedUrl || null;
      } catch (uploadError) {
        console.warn('Profile image upload failed, continuing without image:', uploadError.message);
        profileImageUrl = null;
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const patient = queryRunner.manager.create(Patient, {
        name: dto.name,
        email: dto.email,
        gender: dto.gender,
        phone: dto.phone,
        birthDate: new Date(dto.birthDate),
        profileImage: profileImageUrl,
        type: 'patient',
        isShadow: true,
        doctorCreatorId: dto.doctorCreatorId,
      });

      const savedPatient = await queryRunner.manager.save(patient);

      await this.emailService.sendInviteEmail(dto.email, dto.name, doctor.name);

      await queryRunner.commitTransaction();

      return {
        message: 'Shadow patient created successfully. Invitation email sent.',
        user: this.sanitizeUser(savedPatient),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async registerDoctor(dto: RegisterDoctorDto, file?: Express.Multer.File) {
    // Check all conflicts at once
    const conflicts: string[] = [];

    // Only check email conflict with other doctors (not patients)
    const existingDoctorEmail = await this.doctorRepository.findOne({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (existingDoctorEmail) {
      conflicts.push('email');
    }

    const existingPhone = await this.doctorRepository.findOne({
      where: { phone: dto.phone },
    });
    if (existingPhone) {
      conflicts.push('phone');
    }

    const existingCrm = await this.doctorRepository.findOne({
      where: { crm: dto.crm },
    });
    if (existingCrm) {
      conflicts.push('crm');
    }

    if (conflicts.length > 0) {
      throw new ConflictException({
        message: 'Dados já cadastrados',
        conflicts,
      });
    }

    let profileImageUrl = null;
    if (file) {
      try {
        const uploadedUrl = await this.uploadService.uploadFile(file, 'profiles');
        profileImageUrl = uploadedUrl || null;
      } catch (uploadError) {
        console.warn('Profile image upload failed, continuing without image:', uploadError.message);
        profileImageUrl = null;
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const doctor = queryRunner.manager.create(Doctor, {
        name: dto.name,
        email: dto.email,
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

      // Send email verification code
      const verificationCode = this.generateVerificationCode();
      savedDoctor.verificationCode = verificationCode;
      savedDoctor.verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
      await queryRunner.manager.save(savedDoctor);
      await this.emailService.sendEmailVerificationCode(dto.email, verificationCode, dto.name);

      await queryRunner.commitTransaction();

      const token = await this.generateToken(savedDoctor);
      const doctorContext = await this.getDoctorAuthContext(savedDoctor.id);

      return {
        user: this.sanitizeUser(savedDoctor, doctorContext),
        token,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async login(dto: LoginDto) {
    const loginUser = await this.findLoginUserByEmail(dto.email, dto.loginAs);

    if (!loginUser) {
      // REQ-AUD-027 — LOGIN_FAILURE
      await this.auditService.recordSecurityEvent(AuditAction.LOGIN_FAILURE, {
        resourceType: AuditResourceType.USER,
        success: false,
        reason: 'AUTHENTICATION_FAILED',
        metadata: { email: dto.email },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.isRoleProfile(loginUser)) {
      if (!loginUser.password) {
        await this.auditService.recordSecurityEvent(AuditAction.LOGIN_FAILURE, {
          resourceType: AuditResourceType.USER,
          resourceId: loginUser.id,
          success: false,
          reason: 'AUTHENTICATION_FAILED',
        });
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(dto.password, loginUser.password);

      if (!isPasswordValid) {
        await this.auditService.recordSecurityEvent(AuditAction.LOGIN_FAILURE, {
          resourceType: AuditResourceType.USER,
          resourceId: loginUser.id,
          success: false,
          reason: 'AUTHENTICATION_FAILED',
        });
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if this is a Secretary from the new table (has clinicId, no professionalId)
      if ('clinicId' in loginUser && !('professionalId' in loginUser)) {
        const secretary = loginUser as Secretary;
        if (secretary.isShadow) {
          throw new UnauthorizedException('Account needs to be activated first');
        }

        const token = this.jwtService.sign({
          email: secretary.email,
          sub: secretary.id,
          type: 'doctor',
          role: 'secretary',
          activeClinicId: secretary.clinicId,
        });

        await this.auditService.recordSecurityEvent(AuditAction.LOGIN, {
          resourceType: AuditResourceType.USER,
          resourceId: secretary.id,
          metadata: { loginAs: 'secretary', clinicId: secretary.clinicId },
        });

        return {
          user: {
            id: secretary.id,
            name: secretary.name,
            email: secretary.email,
            type: 'doctor',
            role: 'secretary',
            activeClinicId: secretary.clinicId,
          },
          token,
        };
      }

      // ClinicAdminProfile flow (legacy)
      if (!loginUser.professionalId) {
        throw new UnauthorizedException('Role profile is not linked to a professional account');
      }

      const professional = await this.doctorRepository.findOne({
        where: { id: loginUser.professionalId },
      });

      if (!professional) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (professional.isShadow) {
        throw new UnauthorizedException('Shadow account needs to be activated first');
      }

      const token = await this.generateToken(professional);
      const doctorContext = await this.getDoctorAuthContext(professional.id);

      // REQ-AUD-027 — LOGIN success
      await this.auditService.recordSecurityEvent(AuditAction.LOGIN, {
        resourceType: AuditResourceType.USER,
        resourceId: professional.id,
        metadata: { loginAs: 'role_profile', role: doctorContext.role },
      });

      return {
        user: this.sanitizeUser(professional, doctorContext),
        token,
      };
    }

    const user = loginUser;

    if (user.isShadow) {
      throw new UnauthorizedException('Shadow account needs to be activated first');
    }

    if (!user.password) {
      await this.auditService.recordSecurityEvent(AuditAction.LOGIN_FAILURE, {
        resourceType: AuditResourceType.USER,
        resourceId: user.id,
        success: false,
        reason: 'AUTHENTICATION_FAILED',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      await this.auditService.recordSecurityEvent(AuditAction.LOGIN_FAILURE, {
        resourceType: AuditResourceType.USER,
        resourceId: user.id,
        success: false,
        reason: 'AUTHENTICATION_FAILED',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = await this.generateToken(user);

    const doctorContext =
      user.type === 'doctor' ? await this.getDoctorAuthContext(user.id) : undefined;

    // REQ-AUD-027 — LOGIN success
    await this.auditService.recordSecurityEvent(AuditAction.LOGIN, {
      resourceType: AuditResourceType.USER,
      resourceId: user.id,
      metadata: { type: user.type },
    });

    return {
      user: this.sanitizeUser(user, doctorContext),
      token,
    };
  }

  async checkShadowAccount(email: string) {
    const shadow = await this.findAnyShadowByEmail(email);

    if (shadow) {
      // Send verification code automatically
      const verificationCode = this.generateVerificationCode();
      const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

      shadow.verificationCode = verificationCode;
      shadow.verificationCodeExpiry = verificationCodeExpiry;

      await this.patientRepository.save(shadow);
      await this.emailService.sendShadowActivationCode(shadow.email, verificationCode, shadow.name);

      return {
        isShadow: true,
        exists: true,
        email: shadow.email,
        name: shadow.name,
        message: 'Verification code sent to email',
      };
    }

    // Check if an active PATIENT account exists (doctors don't block — dual profile allowed)
    const activePatient = await this.patientRepository.findOne({
      where: { email: email.trim().toLowerCase(), isShadow: false },
    });
    if (activePatient) {
      return { isShadow: false, exists: true };
    }

    // Check secretaries table for shadow accounts
    const secretaryShadow = await this.secretaryRepository.findOne({
      where: { email: email.trim().toLowerCase(), isShadow: true },
    });
    if (secretaryShadow) {
      const verificationCode = this.generateVerificationCode();
      const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

      secretaryShadow.verificationCode = verificationCode;
      secretaryShadow.verificationCodeExpiry = verificationCodeExpiry;

      await this.secretaryRepository.save(secretaryShadow);
      await this.emailService.sendVerificationCode(secretaryShadow.email, verificationCode, secretaryShadow.name);

      return {
        isShadow: true,
        exists: true,
        email: secretaryShadow.email,
        name: secretaryShadow.name,
        message: 'Verification code sent to email',
      };
    }

    return { isShadow: false, exists: false };
  }

  async sendVerificationCode(email: string) {
    const shadow = await this.findAnyShadowByEmail(email);

    if (!shadow) {
      throw new NotFoundException('Shadow account not found');
    }

    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

    shadow.verificationCode = verificationCode;
    shadow.verificationCodeExpiry = verificationCodeExpiry;

    await this.patientRepository.save(shadow);
    await this.emailService.sendShadowActivationCode(email, verificationCode, shadow.name);

    return {
      message: 'Verification code sent to email',
    };
  }

  async validateCode(email: string, verificationCode: string) {
    const normalizedEmail = email.trim().toLowerCase();

    // Check patients (shadow)
    const patient = await this.findAnyShadowByEmail(normalizedEmail);
    if (patient) {
      if (patient.verificationCode !== verificationCode) {
        throw new BadRequestException('Invalid verification code');
      }
      if (!patient.verificationCodeExpiry || new Date() > patient.verificationCodeExpiry) {
        throw new BadRequestException('Verification code expired');
      }
      return { valid: true };
    }

    // Check secretaries
    const secretary = await this.secretaryRepository.findOne({
      where: { email: normalizedEmail, isShadow: true },
    });
    if (secretary) {
      if (secretary.verificationCode !== verificationCode) {
        throw new BadRequestException('Invalid verification code');
      }
      if (!secretary.verificationCodeExpiry || new Date() > secretary.verificationCodeExpiry) {
        throw new BadRequestException('Verification code expired');
      }
      return { valid: true };
    }

    throw new NotFoundException('Account not found');
  }

  async activateShadowAccount(email: string, verificationCode: string, password: string) {
    const user = await this.findAnyShadowByEmail(email);

    // Also check secretaries table
    if (!user) {
      const secretary = await this.secretaryRepository.findOne({
        where: { email: email.trim().toLowerCase(), isShadow: true },
      });

      if (!secretary) {
        throw new NotFoundException('Shadow account not found');
      }

      if (secretary.verificationCode !== verificationCode) {
        throw new BadRequestException('Invalid verification code');
      }

      if (!secretary.verificationCodeExpiry || new Date() > secretary.verificationCodeExpiry) {
        throw new BadRequestException('Verification code expired');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      secretary.password = hashedPassword;
      secretary.isShadow = false;
      secretary.verificationCode = null;
      secretary.verificationCodeExpiry = null;
      secretary.emailVerified = true;

      await this.secretaryRepository.save(secretary);

      return {
        message: 'Account activated successfully',
        user: { id: secretary.id, name: secretary.name, email: secretary.email, type: 'secretary' },
      };
    }

    if (user.verificationCode !== verificationCode) {
      throw new BadRequestException('Invalid verification code');
    }

    if (!user.verificationCodeExpiry || new Date() > user.verificationCodeExpiry) {
      throw new BadRequestException('Verification code expired');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.isShadow = false;
    user.verificationCode = null;
    user.verificationCodeExpiry = null;
    user.emailVerified = true;

    await this.saveUser(user);

    // Merge any other shadow accounts with the same email
    await this.mergeShadowAccounts(user.id, user.email);

    const token = await this.generateToken(user);

    const doctorContext =
      user.type === 'doctor' ? await this.getDoctorAuthContext(user.id) : undefined;

    return {
      message: 'Account activated successfully',
      user: this.sanitizeUser(user, doctorContext),
      token,
    };
  }

  async sendEmailVerification(userId: string, userType: string) {
    const user = await this.findUserById(userId, userType);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

    user.verificationCode = verificationCode;
    user.verificationCodeExpiry = verificationCodeExpiry;

    await this.saveUser(user);
    await this.emailService.sendEmailVerificationCode(user.email, verificationCode, user.name);

    return {
      message: 'Verification code sent to email',
    };
  }

  async verifyEmail(userId: string, userType: string, code: string) {
    const user = await this.findUserById(userId, userType);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    if (user.verificationCode !== code) {
      throw new BadRequestException('Invalid verification code');
    }

    if (!user.verificationCodeExpiry || new Date() > user.verificationCodeExpiry) {
      throw new BadRequestException('Verification code expired');
    }

    user.emailVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpiry = null;

    await this.saveUser(user);

    // Merge any shadow accounts with the same email into this account
    if (user.type === 'patient') {
      await this.mergeShadowAccounts(user.id, user.email);
    }

    return {
      message: 'Email verified successfully',
    };
  }

  async forgotPassword(email: string) {
    const user = await this.findUserByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const resetCode = this.generateVerificationCode();
    const resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

    user.passwordResetCode = resetCode;
    user.passwordResetCodeExpiry = resetCodeExpiry;

    await this.saveUser(user);
    await this.emailService.sendPasswordResetCode(email, resetCode, user.name);

    return {
      message: 'Password reset code sent to email',
    };
  }

  async forgotPasswordDoctor(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const doctor = await this.doctorRepository.findOne({ where: { email: normalizedEmail } });

    if (!doctor) {
      throw new NotFoundException('User not found');
    }

    const resetCode = this.generateVerificationCode();
    const resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

    doctor.passwordResetCode = resetCode;
    doctor.passwordResetCodeExpiry = resetCodeExpiry;

    await this.doctorRepository.save(doctor);
    await this.syncProfessionalDataToRoleProfiles(doctor);
    await this.emailService.sendPasswordResetCode(email, resetCode, doctor.name);

    return { message: 'Password reset code sent to email' };
  }

  async forgotPasswordPatient(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const patient = await this.patientRepository.findOne({
      where: { email: normalizedEmail, isShadow: false },
    });

    if (!patient) {
      throw new NotFoundException('User not found');
    }

    const resetCode = this.generateVerificationCode();
    const resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

    patient.passwordResetCode = resetCode;
    patient.passwordResetCodeExpiry = resetCodeExpiry;

    await this.patientRepository.save(patient);
    await this.emailService.sendPasswordResetCode(email, resetCode, patient.name);

    return { message: 'Password reset code sent to email' };
  }

  async resetPassword(email: string, resetCode: string, newPassword: string) {
    const user = await this.findUserByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.passwordResetCode !== resetCode) {
      throw new BadRequestException('Invalid reset code');
    }

    if (new Date() > user.passwordResetCodeExpiry) {
      throw new BadRequestException('Reset code expired');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.passwordResetCode = null;
    user.passwordResetCodeExpiry = null;

    await this.saveUser(user);

    // REQ-AUD-027 — PASSWORD_RESET
    await this.auditService.recordSecurityEvent(AuditAction.PASSWORD_RESET, {
      resourceType: AuditResourceType.USER,
      resourceId: user.id,
    });

    return {
      message: 'Password reset successfully',
    };
  }

  async resetPasswordDoctor(email: string, resetCode: string, newPassword: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const doctor = await this.doctorRepository.findOne({ where: { email: normalizedEmail } });

    if (!doctor) {
      throw new NotFoundException('User not found');
    }

    if (doctor.passwordResetCode !== resetCode) {
      throw new BadRequestException('Invalid reset code');
    }

    if (new Date() > doctor.passwordResetCodeExpiry) {
      throw new BadRequestException('Reset code expired');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    doctor.password = hashedPassword;
    doctor.passwordResetCode = null;
    doctor.passwordResetCodeExpiry = null;

    await this.doctorRepository.save(doctor);
    await this.syncProfessionalDataToRoleProfiles(doctor);

    await this.auditService.recordSecurityEvent(AuditAction.PASSWORD_RESET, {
      resourceType: AuditResourceType.USER,
      resourceId: doctor.id,
    });

    return { message: 'Password reset successfully' };
  }

  async resetPasswordPatient(email: string, resetCode: string, newPassword: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const patient = await this.patientRepository.findOne({
      where: { email: normalizedEmail, isShadow: false },
    });

    if (!patient) {
      throw new NotFoundException('User not found');
    }

    if (patient.passwordResetCode !== resetCode) {
      throw new BadRequestException('Invalid reset code');
    }

    if (new Date() > patient.passwordResetCodeExpiry) {
      throw new BadRequestException('Reset code expired');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    patient.password = hashedPassword;
    patient.passwordResetCode = null;
    patient.passwordResetCodeExpiry = null;

    await this.patientRepository.save(patient);

    await this.auditService.recordSecurityEvent(AuditAction.PASSWORD_RESET, {
      resourceType: AuditResourceType.USER,
      resourceId: patient.id,
    });

    return { message: 'Password reset successfully' };
  }

  async changePassword(userId: string, userType: string, oldPassword: string, newPassword: string) {
    const user = await this.findUserById(userId, userType);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid old password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;

    await this.saveUser(user);

    // REQ-AUD-027 — PASSWORD_CHANGED
    await this.auditService.recordSecurityEvent(AuditAction.PASSWORD_CHANGED, {
      resourceType: AuditResourceType.USER,
      resourceId: user.id,
    });

    return {
      message: 'Password changed successfully',
    };
  }

  private async generateToken(user: AuthUser) {
    const payload: Record<string, string | null> = {
      email: user.email,
      sub: user.id,
      type: user.type,
    };

    if (user.type === 'doctor') {
      const doctorContext = await this.getDoctorAuthContext(user.id);
      payload.role = doctorContext.role;
      payload.activeClinicId = doctorContext.activeClinicId;
    }

    return this.jwtService.sign(payload);
  }

  private async getDoctorAuthContext(doctorId: string): Promise<DoctorAuthContext> {
    const membership = await this.clinicMembershipRepository.findOne({
      where: { professionalId: doctorId, isActive: true },
      order: { createdAt: 'ASC' },
    });

    return {
      role: membership?.role || ProfessionalRole.DOCTOR,
      activeClinicId: membership?.clinicId || null,
    };
  }

  private isRoleProfile(user: LoginUser): user is ClinicAdminProfile | Secretary {
    return !('type' in user);
  }

  private async findLoginUserByEmail(email: string, loginAs?: string): Promise<LoginUser | null> {
    const normalizedEmail = email.trim().toLowerCase();

    // If explicitly requesting patient login (mobile)
    if (loginAs === 'patient') {
      const patient = await this.patientRepository.findOne({
        where: { email: normalizedEmail, isShadow: false },
      });
      if (patient) return patient;
      // Fallback: try shadow accounts for activation flow
      return null;
    }

    // Default order: clinicAdmin → secretary → doctor → patient
    const clinicAdmin = await this.clinicAdminProfileRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (clinicAdmin) return clinicAdmin;

    const secretary = await this.secretaryRepository.findOne({
      where: { email: normalizedEmail, isActive: true },
    });
    if (secretary) return secretary;

    const doctor = await this.doctorRepository.findOne({ where: { email: normalizedEmail } });
    if (doctor) return doctor;

    const patient = await this.patientRepository.findOne({
      where: { email: normalizedEmail, isShadow: false },
    });
    if (patient) return patient;

    return null;
  }

  private async findUserByEmail(email: string): Promise<AuthUser | null> {
    const normalizedEmail = email.trim().toLowerCase();

    // Order must match findLoginUserByEmail: doctor first, then patient.
    // This ensures forgot-password/reset-password targets the same entity that login will use.
    const doctor = await this.doctorRepository.findOne({ where: { email: normalizedEmail } });
    if (doctor) {
      return doctor;
    }

    // Only find active (non-shadow) patient accounts
    const patient = await this.patientRepository.findOne({
      where: { email: normalizedEmail, isShadow: false },
    });
    if (patient) {
      return patient;
    }

    return null;
  }

  private async findAnyShadowByEmail(email: string): Promise<Patient | null> {
    const normalizedEmail = email.trim().toLowerCase();
    return this.patientRepository.findOne({
      where: { email: normalizedEmail, isShadow: true },
    });
  }

  private async findUserById(userId: string, userType?: string): Promise<AuthUser | null> {
    if (userType === 'patient') {
      return this.patientRepository.findOne({ where: { id: userId } });
    }

    if (userType === 'doctor') {
      return this.doctorRepository.findOne({ where: { id: userId } });
    }

    const patient = await this.patientRepository.findOne({ where: { id: userId } });
    if (patient) {
      return patient;
    }

    return this.doctorRepository.findOne({ where: { id: userId } });
  }

  private async syncProfessionalDataToRoleProfiles(doctor: Doctor): Promise<void> {
    const updatedFields = {
      name: doctor.name,
      email: doctor.email,
      password: doctor.password || null,
      phone: doctor.phone,
      profileImage: doctor.profileImage || null,
      gender: doctor.gender || null,
      birthDate: doctor.birthDate || null,
      cpf: doctor.cpf || null,
    };

    await this.clinicAdminProfileRepository.update({ professionalId: doctor.id }, updatedFields);
  }

  async mergeShadowAccounts(primaryPatientId: string, email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    // Find all shadow patients with the same email, excluding the primary
    const shadows = await this.patientRepository.find({
      where: { email: normalizedEmail, isShadow: true },
    });

    const shadowsToMerge = shadows.filter((s) => s.id !== primaryPatientId);

    if (shadowsToMerge.length === 0) return;

    const queryRunner = this.patientRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const shadow of shadowsToMerge) {
        const shadowId = shadow.id;

        // Migrate all related data to the primary patient
        await queryRunner.query('UPDATE `appointments` SET `patientId` = ? WHERE `patientId` = ?', [primaryPatientId, shadowId]);
        await queryRunner.query('UPDATE `medications` SET `patientId` = ? WHERE `patientId` = ?', [primaryPatientId, shadowId]);
        await queryRunner.query('UPDATE `exams` SET `patientId` = ? WHERE `patientId` = ?', [primaryPatientId, shadowId]);
        await queryRunner.query('UPDATE `patient_diseases` SET `patientId` = ? WHERE `patientId` = ?', [primaryPatientId, shadowId]);
        await queryRunner.query('UPDATE `patient_allergies` SET `patientId` = ? WHERE `patientId` = ?', [primaryPatientId, shadowId]);
        await queryRunner.query('UPDATE `patient_vaccines` SET `patientId` = ? WHERE `patientId` = ?', [primaryPatientId, shadowId]);
        await queryRunner.query('UPDATE `doctor_access_requests` SET `patientId` = ? WHERE `patientId` = ?', [primaryPatientId, shadowId]);
        await queryRunner.query('UPDATE `patient_access_logs` SET `patientId` = ? WHERE `patientId` = ?', [primaryPatientId, shadowId]);

        // Create doctor permission for the doctor who created this shadow
        if (shadow.doctorCreatorId) {
          const existingPermission = await queryRunner.query(
            'SELECT id FROM `doctor_permissions` WHERE `doctorId` = ? AND `patientId` = ? AND `revokedAt` IS NULL LIMIT 1',
            [shadow.doctorCreatorId, primaryPatientId],
          );
          if (existingPermission.length === 0) {
            await queryRunner.query(
              'INSERT INTO `doctor_permissions` (`id`, `doctorId`, `patientId`, `createdAt`, `updatedAt`) VALUES (UUID(), ?, ?, NOW(), NOW())',
              [shadow.doctorCreatorId, primaryPatientId],
            );
          }
        }

        // Delete the merged shadow
        await queryRunner.query('DELETE FROM `patients` WHERE `id` = ?', [shadowId]);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Shadow merge failed:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async saveUser(user: AuthUser): Promise<AuthUser> {
    if (user.type === 'doctor') {
      const savedDoctor = await this.doctorRepository.save(user as Doctor);
      await this.syncProfessionalDataToRoleProfiles(savedDoctor);
      return savedDoctor;
    }

    return this.patientRepository.save(user as Patient);
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private sanitizeUser(user: any, doctorContext?: DoctorAuthContext) {
    const { password, verificationCode, passwordResetCode, ...result } = user;

    if (user?.type === 'doctor') {
      result.role = doctorContext?.role || ProfessionalRole.DOCTOR;
      result.activeClinicId = doctorContext?.activeClinicId || null;
    }

    // Ensure emailVerified is always present
    if (result.emailVerified === undefined) {
      result.emailVerified = true;
    }

    return result;
  }

  async requestAccountDeletion(userId: string, userType: string) {
    const user = await this.findUserById(userId, userType);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

    user.verificationCode = verificationCode;
    user.verificationCodeExpiry = verificationCodeExpiry;

    await this.saveUser(user);
    await this.emailService.sendAccountDeletionCode(user.email, verificationCode, user.name);

    return {
      message: 'Verification code sent to email',
    };
  }

  async deleteAccount(userId: string, userType: string, verificationCode?: string) {
    const user = await this.findUserById(userId, userType);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!verificationCode) {
      throw new BadRequestException('Verification code is required');
    }

    if (user.verificationCode !== verificationCode) {
      throw new BadRequestException('Invalid verification code');
    }

    if (!user.verificationCodeExpiry || new Date() > user.verificationCodeExpiry) {
      throw new BadRequestException('Verification code expired');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (userType === 'patient') {
        await queryRunner.query('DELETE FROM `appointments` WHERE `patientId` = ?', [userId]);
        await queryRunner.query('DELETE FROM `medications` WHERE `patientId` = ?', [userId]);
        await queryRunner.query('DELETE FROM `exams` WHERE `patientId` = ?', [userId]);
        await queryRunner.query('DELETE FROM `patient_diseases` WHERE `patientId` = ?', [userId]);
        await queryRunner.query('DELETE FROM `patient_allergies` WHERE `patientId` = ?', [userId]);
        await queryRunner.query('DELETE FROM `patient_vaccines` WHERE `patientId` = ?', [userId]);
        await queryRunner.query('DELETE FROM `doctor_access_requests` WHERE `patientId` = ?', [userId]);
        await queryRunner.query('DELETE FROM `doctor_permissions` WHERE `patientId` = ?', [userId]);
        await queryRunner.query('DELETE FROM `patient_access_logs` WHERE `patientId` = ?', [userId]);
        await queryRunner.query('DELETE FROM `patients` WHERE `id` = ?', [userId]);
      } else if (userType === 'doctor') {
        await queryRunner.query('DELETE FROM `doctor_access_requests` WHERE `doctorId` = ?', [userId]);
        await queryRunner.query('DELETE FROM `doctor_permissions` WHERE `doctorId` = ?', [userId]);
        await queryRunner.query('DELETE FROM `clinic_memberships` WHERE `professionalId` = ?', [userId]);
        await queryRunner.query('DELETE FROM `doctor_documents` WHERE `doctorId` = ?', [userId]);
        await queryRunner.query('DELETE FROM `clinic_admin_profiles` WHERE `professionalId` = ?', [userId]);
        await queryRunner.query('DELETE FROM `secretary_profiles` WHERE `professionalId` = ?', [userId]);
        await queryRunner.query('DELETE FROM `doctors` WHERE `id` = ?', [userId]);
      }

      // REQ-AUD-003/004 — Audit inside the same transaction
      await this.auditService.recordDelete(
        AuditResourceType.USER,
        userId,
        { patientId: userType === 'patient' ? userId : undefined, reason: 'ACCOUNT_DELETION_REQUESTED', queryRunner },
      );

      await queryRunner.commitTransaction();
      return { message: 'Account deleted successfully' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateProfile(
    userId: string,
    userType: string,
    data: { name?: string; phone?: string; gender?: string; birthDate?: string; specialty?: string; crm?: string; rqe?: string },
    file?: Express.Multer.File,
  ) {
    let profileImageUrl: string | null = null;
    if (file) {
      try {
        profileImageUrl = await this.uploadService.uploadFile(file, 'profiles');
      } catch (uploadError) {
        console.warn('Profile image upload failed:', uploadError.message);
      }
    }

    if (userType === 'doctor') {
      const doctor = await this.doctorRepository.findOne({ where: { id: userId } });
      if (!doctor) throw new NotFoundException('Doctor not found');

      if (data.name) doctor.name = data.name;
      if (data.phone) doctor.phone = data.phone;
      if (data.gender) doctor.gender = data.gender;
      if (data.birthDate) doctor.birthDate = new Date(data.birthDate);
      if (data.specialty) doctor.specialty = data.specialty;
      if (data.crm) doctor.crm = data.crm;
      if (data.rqe !== undefined) doctor.rqe = data.rqe || null;
      if (profileImageUrl) doctor.profileImage = profileImageUrl;

      await this.doctorRepository.save(doctor);
      return { message: 'Profile updated', profileImage: doctor.profileImage };
    }

    if (userType === 'patient') {
      const patient = await this.patientRepository.findOne({ where: { id: userId } });
      if (!patient) throw new NotFoundException('Patient not found');

      if (data.name) patient.name = data.name;
      if (data.phone) patient.phone = data.phone;
      if (data.gender) patient.gender = data.gender;
      if (data.birthDate) patient.birthDate = new Date(data.birthDate);
      if (profileImageUrl) patient.profileImage = profileImageUrl;

      await this.patientRepository.save(patient);
      return { message: 'Profile updated', profileImage: patient.profileImage };
    }

    throw new ForbiddenException('Invalid user type');
  }
}
