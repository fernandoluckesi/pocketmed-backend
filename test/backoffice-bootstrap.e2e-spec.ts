/**
 * Tests for the TEMPORARY bootstrap route that creates the first back office
 * account. Since it creates a privileged account from an unauthenticated
 * request, each safety constraint is pinned here:
 *
 * - disabled when BACKOFFICE_BOOTSTRAP_SECRET is unset
 * - rejects a wrong secret
 * - creates the account with the correct secret
 * - cannot be replayed once an account exists
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { Repository } from 'typeorm';
import request from 'supertest';
import * as bcrypt from 'bcrypt';

import { AuthModule } from '../src/auth/auth.module';
import { AuditModule } from '../src/audit/audit.module';
import { BackofficeModule } from '../src/backoffice/backoffice.module';
import { AuditEvent } from '../src/audit/entities/audit-event.entity';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { BackofficeBoundaryGuard } from '../src/auth/guards/backoffice-boundary.guard';
import { UploadService } from '../src/upload/upload.service';
import { EmailService } from '../src/email/email.service';

import { Patient } from '../src/entities/patient.entity';
import { Doctor } from '../src/entities/doctor.entity';
import { Dependent } from '../src/entities/dependent.entity';
import { Appointment } from '../src/entities/appointment.entity';
import { Medication } from '../src/entities/medication.entity';
import { Exam } from '../src/entities/exam.entity';
import { DoctorAccessRequest } from '../src/entities/doctor-access-request.entity';
import { DoctorPermission } from '../src/entities/doctor-permission.entity';
import { DoctorDocument } from '../src/entities/doctor-document.entity';
import { DependentResponsibleInvite } from '../src/entities/dependent-responsible-invite.entity';
import { Clinic } from '../src/entities/clinic.entity';
import { ClinicMembership } from '../src/entities/clinic-membership.entity';
import { ClinicAdminProfile } from '../src/entities/clinic-admin-profile.entity';
import { SecretaryProfile } from '../src/entities/secretary-profile.entity';
import { Secretary } from '../src/entities/secretary.entity';
import { BackofficeUser, BackofficeRole } from '../src/entities/backoffice-user.entity';

const SECRET = 'bootstrap-secret-for-tests-0123456789';

const ENTITIES = [
  Patient,
  Doctor,
  Dependent,
  Appointment,
  Medication,
  Exam,
  DoctorAccessRequest,
  DoctorPermission,
  DoctorDocument,
  DependentResponsibleInvite,
  Clinic,
  ClinicMembership,
  ClinicAdminProfile,
  SecretaryProfile,
  Secretary,
  BackofficeUser,
  AuditEvent,
];

async function createApp(bootstrapSecret?: string): Promise<INestApplication> {
  const { getMetadataArgsStorage } = require('typeorm');
  for (const column of getMetadataArgsStorage().columns) {
    if (column.options?.type === 'enum') {
      column.options.type = 'varchar';
      column.options.length = 100;
      delete column.options.enum;
      delete column.options.enumName;
    }
    if (column.options?.type === 'json') column.options.type = 'text';
    if (column.options?.type === 'timestamp') column.options.type = 'datetime';
    if (column.options?.type === 'decimal') column.options.type = 'real';
  }

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [
          () => ({
            JWT_SECRET: 'test-jwt-secret-key-for-integration-tests',
            JWT_EXPIRATION: '1h',
            NODE_ENV: 'test',
            EMAIL_ENABLED: 'false',
            ...(bootstrapSecret ? { BACKOFFICE_BOOTSTRAP_SECRET: bootstrapSecret } : {}),
          }),
        ],
      }),
      TypeOrmModule.forRoot({
        type: 'better-sqlite3',
        database: ':memory:',
        entities: ENTITIES,
        synchronize: true,
        dropSchema: true,
      }),
      TypeOrmModule.forFeature(ENTITIES),
      PassportModule,
      JwtModule.register({
        secret: 'test-jwt-secret-key-for-integration-tests',
        signOptions: { expiresIn: '1h' },
      }),
      AuthModule,
      AuditModule,
      BackofficeModule,
    ],
    providers: [
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_GUARD, useClass: BackofficeBoundaryGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  })
    .overrideProvider(UploadService)
    .useValue({ uploadFile: jest.fn(), deleteFile: jest.fn(), onModuleInit: jest.fn() })
    .overrideProvider(EmailService)
    .useValue({
      sendDocumentRejectedNotice: jest.fn(),
      sendDocumentApprovedNotice: jest.fn(),
      sendVerificationApprovedNotice: jest.fn(),
    })
    .compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();

  // SQLite downgrades `json` to `text`; stringify so audit writes work.
  const auditRepository: Repository<AuditEvent> = app.get(getRepositoryToken(AuditEvent));
  for (const column of auditRepository.manager.connection.getMetadata(AuditEvent).columns) {
    if (['changedFields', 'metadata'].includes(column.propertyName)) {
      column.transformer = {
        to: (v: unknown) => (v === null || v === undefined ? v : JSON.stringify(v)),
        from: (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v),
      } as never;
    }
  }

  return app;
}

const validPayload = {
  secret: SECRET,
  name: 'Fernando Luckesi',
  email: 'fernando.luckesi94@gmail.com',
  password: 'senha-aleatoria-forte-123',
};

describe('Back office bootstrap (e2e)', () => {
  describe('when BACKOFFICE_BOOTSTRAP_SECRET is not configured', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createApp(undefined);
    });
    afterAll(async () => {
      await app?.close();
    });

    it('is disabled and creates nothing', async () => {
      const res = await request(app.getHttpServer())
        .post('/backoffice/auth/bootstrap')
        .send(validPayload)
        .expect(403);

      expect(res.body.message).toBe('Bootstrap não está habilitado neste ambiente.');

      const repository: Repository<BackofficeUser> = app.get(getRepositoryToken(BackofficeUser));
      expect(await repository.count()).toBe(0);
    });
  });

  describe('when the secret is configured', () => {
    let app: INestApplication;
    let repository: Repository<BackofficeUser>;

    beforeAll(async () => {
      app = await createApp(SECRET);
      repository = app.get(getRepositoryToken(BackofficeUser));
    });
    afterAll(async () => {
      await app?.close();
    });

    it('rejects a wrong secret', async () => {
      const res = await request(app.getHttpServer())
        .post('/backoffice/auth/bootstrap')
        .send({ ...validPayload, secret: 'wrong-secret-but-same-length-000000' })
        .expect(403);

      expect(res.body.message).toBe('Segredo de bootstrap inválido.');
      expect(await repository.count()).toBe(0);
    });

    it('rejects a short password', async () => {
      await request(app.getHttpServer())
        .post('/backoffice/auth/bootstrap')
        .send({ ...validPayload, password: 'curta' })
        .expect(400);

      expect(await repository.count()).toBe(0);
    });

    it('creates the first account as superadmin', async () => {
      const res = await request(app.getHttpServer())
        .post('/backoffice/auth/bootstrap')
        .send(validPayload)
        .expect(201);

      expect(res.body.user.email).toBe(validPayload.email);
      expect(res.body.user.role).toBe(BackofficeRole.SUPERADMIN);
      // Never echo the password back.
      expect(JSON.stringify(res.body)).not.toContain(validPayload.password);

      const saved = await repository.findOne({ where: { email: validPayload.email } });
      expect(saved).toBeTruthy();
      // Password must be hashed, never stored in clear text.
      expect(saved!.password).not.toBe(validPayload.password);
      expect(await bcrypt.compare(validPayload.password, saved!.password)).toBe(true);
    });

    it('allows logging in with the created account', async () => {
      const res = await request(app.getHttpServer())
        .post('/backoffice/auth/login')
        .send({ email: validPayload.email, password: validPayload.password })
        .expect(200);

      expect(res.body.token).toBeTruthy();
      expect(res.body.user.type).toBe('backoffice');
    });

    it('cannot be replayed once an account exists', async () => {
      const res = await request(app.getHttpServer())
        .post('/backoffice/auth/bootstrap')
        .send({ ...validPayload, email: 'atacante@example.com' })
        .expect(403);

      expect(res.body.message).toContain('Já existe uma conta de backoffice');
      expect(await repository.count()).toBe(1);
      expect(await repository.findOne({ where: { email: 'atacante@example.com' } })).toBeNull();
    });
  });
});
