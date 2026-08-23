import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Secretary } from '../entities/secretary.entity';
import { CreateSecretaryDto } from './dto/create-secretary.dto';
import { UpdateSecretaryDto } from './dto/update-secretary.dto';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditResourceType } from '../audit/audit.constants';

@Injectable()
export class SecretariesService {
  constructor(
    @InjectRepository(Secretary)
    private readonly secretaryRepository: Repository<Secretary>,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateSecretaryDto, clinicId: string, invitedBy: string): Promise<Secretary> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Check uniqueness within secretaries table
    const existing = await this.secretaryRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('Email já cadastrado para um(a) secretário(a).');
    }

    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const secretary = this.secretaryRepository.create({
      name: dto.name.trim(),
      email: normalizedEmail,
      phone: dto.phone.replace(/\D/g, ''),
      clinicId,
      invitedBy,
      isActive: true,
      isShadow: true,
      verificationCode,
      verificationCodeExpiry,
      password: null,
      emailVerified: false,
    });

    const saved = await this.secretaryRepository.save(secretary);

    // Send invitation email
    await this.emailService.sendVerificationCode(normalizedEmail, verificationCode, dto.name.trim());

    // Audit
    await this.auditService.recordCreate(AuditResourceType.USER, saved.id, {
      metadata: { role: 'secretary', clinicId, invitedBy },
    });

    return this.sanitize(saved);
  }

  async findAllByClinic(clinicId: string): Promise<Secretary[]> {
    const secretaries = await this.secretaryRepository.find({
      where: { clinicId },
      order: { createdAt: 'DESC' },
    });
    return secretaries.map((s) => this.sanitize(s));
  }

  async findOne(id: string, clinicId: string): Promise<Secretary> {
    const secretary = await this.secretaryRepository.findOne({
      where: { id, clinicId },
    });
    if (!secretary) {
      throw new NotFoundException('Secretário(a) não encontrado(a).');
    }
    return this.sanitize(secretary);
  }

  async update(id: string, clinicId: string, dto: UpdateSecretaryDto): Promise<Secretary> {
    const secretary = await this.secretaryRepository.findOne({
      where: { id, clinicId },
    });
    if (!secretary) {
      throw new NotFoundException('Secretário(a) não encontrado(a).');
    }

    const changedFields: Record<string, { before?: unknown; after?: unknown }> = {};

    if (dto.name && dto.name.trim() !== secretary.name) {
      changedFields.name = { before: secretary.name, after: dto.name.trim() };
      secretary.name = dto.name.trim();
    }

    if (dto.email) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      if (normalizedEmail !== secretary.email) {
        // Check uniqueness
        const existing = await this.secretaryRepository.findOne({
          where: { email: normalizedEmail },
        });
        if (existing && existing.id !== id) {
          throw new ConflictException('Email já cadastrado para outro(a) secretário(a).');
        }
        changedFields.email = { before: secretary.email, after: normalizedEmail };
        secretary.email = normalizedEmail;
      }
    }

    if (dto.phone) {
      const normalizedPhone = dto.phone.replace(/\D/g, '');
      if (normalizedPhone !== secretary.phone) {
        changedFields.phone = { before: secretary.phone, after: normalizedPhone };
        secretary.phone = normalizedPhone;
      }
    }

    const saved = await this.secretaryRepository.save(secretary);

    // Audit
    if (Object.keys(changedFields).length > 0) {
      await this.auditService.recordUpdate(AuditResourceType.USER, id, changedFields, {
        metadata: { role: 'secretary', clinicId },
      });
    }

    return this.sanitize(saved);
  }

  async remove(id: string, clinicId: string): Promise<void> {
    const secretary = await this.secretaryRepository.findOne({
      where: { id, clinicId },
    });
    if (!secretary) {
      throw new NotFoundException('Secretário(a) não encontrado(a).');
    }

    // Hard delete
    await this.secretaryRepository.remove(secretary);

    // Audit
    await this.auditService.recordDelete(AuditResourceType.USER, id, {
      metadata: { role: 'secretary', clinicId, name: secretary.name, email: secretary.email },
    });
  }

  /**
   * Activate a secretary account (set password, mark as non-shadow).
   */
  async activate(email: string, verificationCode: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const secretary = await this.secretaryRepository.findOne({
      where: { email: normalizedEmail, isShadow: true },
    });

    if (!secretary) {
      throw new NotFoundException('Conta não encontrada.');
    }

    if (secretary.verificationCode !== verificationCode) {
      throw new ForbiddenException('Código inválido.');
    }

    if (!secretary.verificationCodeExpiry || new Date() > secretary.verificationCodeExpiry) {
      throw new ForbiddenException('Código expirado.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    secretary.password = hashedPassword;
    secretary.isShadow = false;
    secretary.verificationCode = null;
    secretary.verificationCodeExpiry = null;
    secretary.emailVerified = true;

    await this.secretaryRepository.save(secretary);

    return { message: 'Conta ativada com sucesso.' };
  }

  /**
   * Find secretary by email for login purposes.
   */
  async findByEmail(email: string): Promise<Secretary | null> {
    return this.secretaryRepository.findOne({
      where: { email: email.trim().toLowerCase(), isActive: true },
    });
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private sanitize(secretary: Secretary): Secretary {
    const { password, verificationCode, passwordResetCode, ...rest } = secretary as any;
    return rest;
  }
}
