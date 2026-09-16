import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { BackofficeUser, BackofficeRole } from '../entities/backoffice-user.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditResourceType } from '../audit/audit.constants';

@Injectable()
export class BackofficeAuthService {
  private readonly logger = new Logger(BackofficeAuthService.name);

  constructor(
    @InjectRepository(BackofficeUser)
    private backofficeUserRepository: Repository<BackofficeUser>,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * One-shot bootstrap of the FIRST back office account.
   *
   * This exists only because there is no shell access to the production database.
   * It is deliberately hard to abuse:
   *
   * 1. Requires the `BACKOFFICE_BOOTSTRAP_SECRET` env var. If unset, the endpoint
   *    is disabled — so it is inert unless someone explicitly enables it.
   * 2. Refuses to run once ANY back office user exists, so it cannot be replayed
   *    to add a second privileged account or overwrite an existing one.
   * 3. Compares the secret in constant time to avoid leaking it via timing.
   * 4. Every attempt (success or failure) is written to the audit trail.
   *
   * Remove this method, its controller route and the env var once the first
   * account is created.
   */
  async bootstrapFirstUser(input: {
    secret: string;
    name: string;
    email: string;
    password: string;
  }) {
    const expectedSecret = this.configService.get<string>('BACKOFFICE_BOOTSTRAP_SECRET');

    if (!expectedSecret) {
      await this.auditService.recordAccessDenied(AuditResourceType.USER, {
        reason: 'INVALID_STATE',
        metadata: { scope: 'backoffice', operation: 'bootstrap', detail: 'SECRET_NOT_CONFIGURED' },
      });
      throw new ForbiddenException('Bootstrap não está habilitado neste ambiente.');
    }

    if (!this.secretMatches(input.secret, expectedSecret)) {
      await this.auditService.recordAccessDenied(AuditResourceType.USER, {
        reason: 'AUTHENTICATION_FAILED',
        metadata: { scope: 'backoffice', operation: 'bootstrap', detail: 'INVALID_SECRET' },
      });
      throw new ForbiddenException('Segredo de bootstrap inválido.');
    }

    const existingCount = await this.backofficeUserRepository.count();
    if (existingCount > 0) {
      await this.auditService.recordAccessDenied(AuditResourceType.USER, {
        reason: 'INVALID_STATE',
        metadata: {
          scope: 'backoffice',
          operation: 'bootstrap',
          detail: 'ALREADY_INITIALIZED',
          existingCount,
        },
      });
      throw new ForbiddenException(
        'Já existe uma conta de backoffice. Este recurso serve apenas para a primeira conta.',
      );
    }

    const email = input.email.trim().toLowerCase();
    const created = await this.backofficeUserRepository.save(
      this.backofficeUserRepository.create({
        name: input.name.trim(),
        email,
        password: await bcrypt.hash(input.password, 10),
        backofficeRole: BackofficeRole.SUPERADMIN,
        isActive: true,
      }),
    );

    await this.auditService.recordCreate(AuditResourceType.USER, created.id, {
      metadata: {
        scope: 'backoffice',
        operation: 'bootstrap',
        email,
        backofficeRole: BackofficeRole.SUPERADMIN,
      },
    });

    this.logger.warn(
      `Back office bootstrap used to create ${email}. Remove the bootstrap route and BACKOFFICE_BOOTSTRAP_SECRET now.`,
    );

    return {
      user: {
        id: created.id,
        name: created.name,
        email: created.email,
        type: 'backoffice',
        role: created.backofficeRole,
      },
      warning: 'Conta criada. Remova a rota de bootstrap e a variável BACKOFFICE_BOOTSTRAP_SECRET.',
    };
  }

  /** Constant-time comparison so the secret cannot be guessed by timing. */
  private secretMatches(received: string, expected: string): boolean {
    const a = Buffer.from(String(received));
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

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
