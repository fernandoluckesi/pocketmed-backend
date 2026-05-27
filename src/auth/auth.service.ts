import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { ClinicAdminProfile } from '../entities/clinic-admin-profile.entity';
import { SecretaryProfile } from '../entities/secretary-profile.entity';
import { ProfessionalRole } from './professional-role.enum';

type AuthUser = Patient | Doctor;

type DoctorAuthContext = {
  role: ProfessionalRole;
  activeClinicId: string | null;
};

type LoginUser = AuthUser | ClinicAdminProfile | SecretaryProfile;

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
    @InjectRepository(SecretaryProfile)
    private secretaryProfileRepository: Repository<SecretaryProfile>,
    private jwtService: JwtService,
    private uploadService: UploadService,
    private emailService: EmailService,
  ) {}

  async registerPatient(dto: RegisterPatientDto, file?: Express.Multer.File) {
    console.log('=== REGISTER PATIENT ===');
    console.log('DTO:', dto);
    console.log(
      'File received:',
      file
        ? {
            fieldname: file.fieldname,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          }
        : 'No file',
    );

    const existingUser = await this.findUserByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    let profileImageUrl = null;
    if (file) {
      console.log('Uploading file to MinIO...');
      try {
        const uploadedUrl = await this.uploadService.uploadFile(file, 'profiles');
        profileImageUrl = uploadedUrl || null;
        console.log('File uploaded. URL:', profileImageUrl);
      } catch (uploadError) {
        console.warn('Profile image upload failed, continuing without image:', uploadError.message);
        profileImageUrl = null;
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const patient = this.patientRepository.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      gender: dto.gender,
      phone: dto.phone,
      birthDate: new Date(dto.birthDate),
      profileImage: profileImageUrl,
      type: 'patient',
      isShadow: false,
    });

    const savedPatient = await this.patientRepository.save(patient);
    console.log('Patient saved with profileImage:', savedPatient.profileImage);

    const token = await this.generateToken(savedPatient);

    return {
      user: this.sanitizeUser(savedPatient),
      token,
    };
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

    const existingUser = await this.findUserByEmail(dto.email);

    if (existingUser) {
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

    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const patient = this.patientRepository.create({
      name: dto.name,
      email: dto.email,
      gender: dto.gender,
      phone: dto.phone,
      birthDate: new Date(dto.birthDate),
      profileImage: profileImageUrl,
      type: 'patient',
      isShadow: true,
      doctorCreatorId: dto.doctorCreatorId,
      verificationCode,
      verificationCodeExpiry,
    });

    const savedPatient = await this.patientRepository.save(patient);

    await this.emailService.sendVerificationCode(dto.email, verificationCode, dto.name);

    return {
      message: 'Shadow patient created successfully. Verification code sent to email.',
      user: this.sanitizeUser(savedPatient),
    };
  }

  async registerDoctor(dto: RegisterDoctorDto, file?: Express.Multer.File) {
    // Check all conflicts at once
    const conflicts: string[] = [];

    const existingEmail = await this.findUserByEmail(dto.email);
    if (existingEmail) {
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

    const doctor = this.doctorRepository.create({
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
    });

    const savedDoctor = await this.doctorRepository.save(doctor);

    const token = await this.generateToken(savedDoctor);

    const doctorContext = await this.getDoctorAuthContext(savedDoctor.id);

    return {
      user: this.sanitizeUser(savedDoctor, doctorContext),
      token,
    };
  }

  async login(dto: LoginDto) {
    const loginUser = await this.findLoginUserByEmail(dto.email);

    if (!loginUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.isRoleProfile(loginUser)) {
      if (!loginUser.password) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(dto.password, loginUser.password);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

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
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = await this.generateToken(user);

    const doctorContext =
      user.type === 'doctor' ? await this.getDoctorAuthContext(user.id) : undefined;

    return {
      user: this.sanitizeUser(user, doctorContext),
      token,
    };
  }

  async sendVerificationCode(email: string) {
    const user = await this.findUserByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isShadow) {
      throw new BadRequestException('This account is already activated');
    }

    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

    user.verificationCode = verificationCode;
    user.verificationCodeExpiry = verificationCodeExpiry;

    await this.saveUser(user);
    await this.emailService.sendVerificationCode(email, verificationCode, user.name);

    return {
      message: 'Verification code sent to email',
    };
  }

  async activateShadowAccount(email: string, verificationCode: string, password: string) {
    const user = await this.findUserByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isShadow) {
      throw new BadRequestException('This account is already activated');
    }

    if (user.verificationCode !== verificationCode) {
      throw new BadRequestException('Invalid verification code');
    }

    if (new Date() > user.verificationCodeExpiry) {
      throw new BadRequestException('Verification code expired');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.isShadow = false;
    user.verificationCode = null;
    user.verificationCodeExpiry = null;

    await this.saveUser(user);

    const token = await this.generateToken(user);

    const doctorContext =
      user.type === 'doctor' ? await this.getDoctorAuthContext(user.id) : undefined;

    return {
      message: 'Account activated successfully',
      user: this.sanitizeUser(user, doctorContext),
      token,
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

    return {
      message: 'Password reset successfully',
    };
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

  private isRoleProfile(user: LoginUser): user is ClinicAdminProfile | SecretaryProfile {
    return !('type' in user);
  }

  private async findLoginUserByEmail(email: string): Promise<LoginUser | null> {
    const normalizedEmail = email.trim().toLowerCase();

    const patient = await this.patientRepository.findOne({ where: { email: normalizedEmail } });
    if (patient) {
      return patient;
    }

    const clinicAdmin = await this.clinicAdminProfileRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (clinicAdmin) {
      return clinicAdmin;
    }

    const secretary = await this.secretaryProfileRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (secretary) {
      return secretary;
    }

    return this.doctorRepository.findOne({ where: { email: normalizedEmail } });
  }

  private async findUserByEmail(email: string): Promise<AuthUser | null> {
    const patient = await this.patientRepository.findOne({ where: { email } });
    if (patient) {
      return patient;
    }

    return this.doctorRepository.findOne({ where: { email } });
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
    await this.secretaryProfileRepository.update({ professionalId: doctor.id }, updatedFields);
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

    return result;
  }
}
