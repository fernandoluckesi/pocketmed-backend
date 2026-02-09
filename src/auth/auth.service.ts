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
import { User } from '../entities/user.entity';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { RegisterDoctorDto } from './dto/register-doctor.dto';
import { RegisterPatientShadowDto } from './dto/register-patient-shadow.dto';
import { LoginDto } from './dto/login.dto';
import { UploadService } from '../upload/upload.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    private jwtService: JwtService,
    private uploadService: UploadService,
    private emailService: EmailService,
  ) {}

  async registerPatient(dto: RegisterPatientDto, file?: Express.Multer.File) {
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    let profileImageUrl = null;
    if (file) {
      profileImageUrl = await this.uploadService.uploadFile(file, 'profiles');
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

    const token = this.generateToken(savedPatient);

    return {
      user: this.sanitizeUser(savedPatient),
      token,
    };
  }

  async registerPatientShadow(dto: RegisterPatientShadowDto, file?: Express.Multer.File) {
    const doctor = await this.doctorRepository.findOne({
      where: { id: dto.doctorCreatorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    let profileImageUrl = null;
    if (file) {
      profileImageUrl = await this.uploadService.uploadFile(file, 'profiles');
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
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    let profileImageUrl = null;
    if (file) {
      profileImageUrl = await this.uploadService.uploadFile(file, 'profiles');
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
      profileImage: profileImageUrl,
      type: 'doctor',
      isShadow: false,
    });

    const savedDoctor = await this.doctorRepository.save(doctor);

    const token = this.generateToken(savedDoctor);

    return {
      user: this.sanitizeUser(savedDoctor),
      token,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

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

    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  async sendVerificationCode(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });

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

    await this.userRepository.save(user);
    await this.emailService.sendVerificationCode(email, verificationCode, user.name);

    return {
      message: 'Verification code sent to email',
    };
  }

  async activateShadowAccount(email: string, verificationCode: string, password: string) {
    const user = await this.userRepository.findOne({ where: { email } });

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

    await this.userRepository.save(user);

    const token = this.generateToken(user);

    return {
      message: 'Account activated successfully',
      user: this.sanitizeUser(user),
      token,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const resetCode = this.generateVerificationCode();
    const resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

    user.passwordResetCode = resetCode;
    user.passwordResetCodeExpiry = resetCodeExpiry;

    await this.userRepository.save(user);
    await this.emailService.sendPasswordResetCode(email, resetCode, user.name);

    return {
      message: 'Password reset code sent to email',
    };
  }

  async resetPassword(email: string, resetCode: string, newPassword: string) {
    const user = await this.userRepository.findOne({ where: { email } });

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

    await this.userRepository.save(user);

    return {
      message: 'Password reset successfully',
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid old password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;

    await this.userRepository.save(user);

    return {
      message: 'Password changed successfully',
    };
  }

  private generateToken(user: User) {
    const payload = { email: user.email, sub: user.id, type: user.type };
    return this.jwtService.sign(payload);
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private sanitizeUser(user: any) {
    const { password, verificationCode, passwordResetCode, ...result } = user;
    return result;
  }
}
