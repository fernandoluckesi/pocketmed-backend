import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { BackofficeUser } from '../entities/backoffice-user.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditResourceType } from '../audit/audit.constants';

@Injectable()
export class BackofficeAuthService {
  constructor(
    @InjectRepository(BackofficeUser)
    private backofficeUserRepository: Repository<BackofficeUser>,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Authenticates internal staff. Kept separate from the clinic/patient login on
   * purpose: back office tokens carry `type: 'backoffice'` and no clinic context,
   * so they can never be mistaken for a clinical account.
   */
  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.backofficeUserRepository.findOne({
      where: { email: normalizedEmail },
    });

    // Same generic error for unknown email, wrong password and inactive account
    // so the endpoint cannot be used to enumerate staff accounts. The specific
    // reason goes to the audit trail only.
    const failLogin = async (reason: string) => {
      await this.auditService.recordSecurityEvent(AuditAction.LOGIN_FAILURE, {
        resourceType: AuditResourceType.USER,
        resourceId: user?.id,
        success: false,
        reason: 'AUTHENTICATION_FAILED',
        metadata: { email: normalizedEmail, scope: 'backoffice', detail: reason },
      });
      throw new UnauthorizedException('Email ou senha inválidos.');
    };

    if (!user) return failLogin('USER_NOT_FOUND');
    if (!user.isActive) return failLogin('USER_INACTIVE');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return failLogin('INVALID_PASSWORD');

    const token = this.jwtService.sign({
      email: user.email,
      sub: user.id,
      type: 'backoffice',
      role: user.backofficeRole,
    });

    await this.backofficeUserRepository.update(user.id, { lastLoginAt: new Date() });

    await this.auditService.recordSecurityEvent(AuditAction.LOGIN, {
      resourceType: AuditResourceType.USER,
      resourceId: user.id,
      metadata: { scope: 'backoffice', backofficeRole: user.backofficeRole },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        type: 'backoffice',
        role: user.backofficeRole,
      },
      token,
    };
  }

  async getProfile(userId: string) {
    const user = await this.backofficeUserRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Sessão inválida. Faça login novamente.');
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      type: 'backoffice',
      role: user.backofficeRole,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
