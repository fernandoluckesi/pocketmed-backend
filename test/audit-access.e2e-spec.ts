/**
 * Audit access-control tests.
 *
 * Covers the platform-admin vs clinic-admin separation:
 * - A clinic admin may only read the audit trail of their OWN clinic, even when
 *   they try to widen the scope via query params.
 * - Platform-level audit operations (integrity/monitoring/retention) belong to
 *   internal back office staff only.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { Repository } from 'typeorm';
import request from 'supertest';

import { AuditModule } from '../src/audit/audit.module';
import { AuthModule } from '../src/auth/auth.module';
import { AuditEvent } from '../src/audit/entities/audit-event.entity';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
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
import { ClinicMembership } from '../src/entities/clinic-membership.entity';
import { ClinicAdminProfile } from '../src/entities/clinic-admin-profile.entity';
import { SecretaryProfile } from '../src/entities/secretary-profile.entity';
import { Secretary } from '../src/entities/secretary.entity';
import { Clinic } from '../src/entities/clinic.entity';
import { BackofficeUser, BackofficeRole } from '../src/entities/backoffice-user.entity';
import { ProfessionalRole } from '../src/auth/professional-role.enum';

/**
 * Declared locally instead of reusing test-utils' ALL_ENTITIES: that helper also
 * pulls in ExamCatalogModule, which depends on optional OCR/PDF packages that
 * are not required for these tests.
 */
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

const mockUploadService = {
  uploadFile: jest.fn().mockResolvedValue(null),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  onModuleInit: jest.fn().mockResolvedValue(undefined),
};

const mockEmailService = {
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
};

const CLINIC_A = '11111111-1111-1111-1111-111111111111';
const CLINIC_B = '22222222-2222-2222-2222-222222222222';

describe('Audit access control (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let auditRepository: Repository<AuditEvent>;
  let doctorRepository: Repository<Doctor>;
  let membershipRepository: Repository<ClinicMembership>;
  let backofficeRepository: Repository<BackofficeUser>;

  let adminAToken: string;
  let adminBToken: string;
  let backofficeToken: string;
  let eventIdClinicA: string;
  let eventIdClinicB: string;

  beforeAll(async () => {
    // Same enum/json/timestamp patching the shared helper does for SQLite.
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

    const entities = ENTITIES;

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
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities,
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature(entities),
        PassportModule,
        JwtModule.register({
          secret: 'test-jwt-secret-key-for-integration-tests',
          signOptions: { expiresIn: '1h' },
        }),
        AuthModule,
        AuditModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    })
      .overrideProvider(UploadService)
      .useValue(mockUploadService)
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    jwtService = app.get(JwtService);
    auditRepository = app.get(getRepositoryToken(AuditEvent));

    // The `json` columns are downgraded to `text` for SQLite, so TypeORM does not
    // serialize objects automatically. Stringify them on write to keep the
    // in-memory harness working; MySQL handles this natively in production.
    const auditDataSource = auditRepository.manager.connection;
    for (const column of auditDataSource.getMetadata(AuditEvent).columns) {
      if (['changedFields', 'metadata'].includes(column.propertyName)) {
        column.transformer = {
          to: (value: unknown) =>
            value === null || value === undefined ? value : JSON.stringify(value),
          from: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
        } as never;
      }
    }
    doctorRepository = app.get(getRepositoryToken(Doctor));
    membershipRepository = app.get(getRepositoryToken(ClinicMembership));
    backofficeRepository = app.get(getRepositoryToken(BackofficeUser));

    // --- Two clinics (FK targets for the memberships) ----------------------
    const clinicRepository = app.get(getRepositoryToken(Clinic));
    await clinicRepository.save(
      clinicRepository.create({ id: CLINIC_A, name: 'Clínica A', isActive: true }),
    );
    await clinicRepository.save(
      clinicRepository.create({ id: CLINIC_B, name: 'Clínica B', isActive: true }),
    );

    // --- Two clinic admins, one per clinic ---------------------------------
    const adminA = await doctorRepository.save(
      doctorRepository.create({
        name: 'Admin Clinica A',
        email: 'admin-a@test.com',
        password: 'hashed',
        type: 'doctor',
        gender: 'Masculino',
        specialty: 'Clínica Geral',
        cpf: '11111111111',
        phone: '(11) 90000-0001',
        birthDate: new Date('1980-01-01'),
        crm: '111111/SP',
      } as Partial<Doctor>),
    );
    const adminB = await doctorRepository.save(
      doctorRepository.create({
        name: 'Admin Clinica B',
        email: 'admin-b@test.com',
        password: 'hashed',
        type: 'doctor',
        gender: 'Feminino',
        specialty: 'Clínica Geral',
        cpf: '22222222222',
        phone: '(11) 90000-0002',
        birthDate: new Date('1980-01-02'),
        crm: '222222/SP',
      } as Partial<Doctor>),
    );

    await membershipRepository.save(
      membershipRepository.create({
        clinicId: CLINIC_A,
        professionalId: adminA.id,
        role: ProfessionalRole.ADMIN,
        isActive: true,
      } as Partial<ClinicMembership>),
    );
    await membershipRepository.save(
      membershipRepository.create({
        clinicId: CLINIC_B,
        professionalId: adminB.id,
        role: ProfessionalRole.ADMIN,
        isActive: true,
      } as Partial<ClinicMembership>),
    );

    adminAToken = jwtService.sign({
      sub: adminA.id,
      email: adminA.email,
      type: 'doctor',
      role: ProfessionalRole.ADMIN,
      activeClinicId: CLINIC_A,
    });
    adminBToken = jwtService.sign({
      sub: adminB.id,
      email: adminB.email,
      type: 'doctor',
      role: ProfessionalRole.ADMIN,
      activeClinicId: CLINIC_B,
    });

    // --- Internal back office staff ---------------------------------------
    const staff = await backofficeRepository.save(
      backofficeRepository.create({
        name: 'Staff Hispora',
        email: 'staff@hispora.com',
        password: 'hashed',
        backofficeRole: BackofficeRole.SUPERADMIN,
        isActive: true,
      } as Partial<BackofficeUser>),
    );
    backofficeToken = jwtService.sign({
      sub: staff.id,
      email: staff.email,
      type: 'backoffice',
      role: BackofficeRole.SUPERADMIN,
    });

    // --- Seed audit events for both clinics -------------------------------
    const eventA = await auditRepository.save(
      auditRepository.create({
        tenantId: CLINIC_A,
        action: 'READ',
        resourceType: 'PATIENT',
        resourceId: 'patient-a',
        patientId: 'patient-a',
        success: true,
        timestamp: new Date(),
      } as Partial<AuditEvent>),
    );
    const eventB = await auditRepository.save(
      auditRepository.create({
        tenantId: CLINIC_B,
        action: 'READ',
        resourceType: 'PATIENT',
        resourceId: 'patient-b',
        patientId: 'patient-b',
        success: true,
        timestamp: new Date(),
      } as Partial<AuditEvent>),
    );
    eventIdClinicA = eventA.id;
    eventIdClinicB = eventB.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /audit/events — clinic admin scoping', () => {
    it('returns only events from the admin own clinic', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit/events')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);

      const tenants: string[] = res.body.data.map((e: AuditEvent) => e.tenantId);
      expect(tenants.length).toBeGreaterThan(0);
      expect(tenants.every((t) => t === CLINIC_A)).toBe(true);
      expect(tenants).not.toContain(CLINIC_B);
    });

    it('ignores a tenantId query param pointing at another clinic', async () => {
      const res = await request(app.getHttpServer())
        .get(`/audit/events?tenantId=${CLINIC_B}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);

      const tenants: string[] = res.body.data.map((e: AuditEvent) => e.tenantId);
      expect(tenants).not.toContain(CLINIC_B);
      expect(tenants.every((t) => t === CLINIC_A)).toBe(true);
    });

    it('does not leak events from clinic A to clinic B admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit/events')
        .set('Authorization', `Bearer ${adminBToken}`)
        .expect(200);

      const resourceIds: string[] = res.body.data.map((e: AuditEvent) => e.resourceId);
      expect(resourceIds).not.toContain('patient-a');
    });

    it('rejects unauthenticated access', async () => {
      await request(app.getHttpServer()).get('/audit/events').expect(401);
    });
  });

  describe('GET /audit/events/:id — cross-tenant probing', () => {
    it('returns the event when it belongs to the admin clinic', async () => {
      const res = await request(app.getHttpServer())
        .get(`/audit/events/${eventIdClinicA}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);

      expect(res.body.id).toBe(eventIdClinicA);
    });

    it('hides an event that belongs to another clinic', async () => {
      const res = await request(app.getHttpServer())
        .get(`/audit/events/${eventIdClinicB}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);

      // Same shape as "not found" so ids cannot be probed across tenants.
      expect(res.body.message).toBe('Audit event not found');
      expect(res.body.id).toBeUndefined();
    });
  });

  describe('Platform-level audit operations', () => {
    const platformRoutes = [
      '/audit/integrity/full',
      '/audit/integrity/recent',
      '/audit/monitoring/health',
      '/audit/monitoring/alerts',
      '/audit/retention/policy',
    ];

    it.each(platformRoutes)('denies clinic admin on GET %s', async (route) => {
      await request(app.getHttpServer())
        .get(route)
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(403);
    });

    it('denies clinic admin on POST /audit/retention/run', async () => {
      await request(app.getHttpServer())
        .post('/audit/retention/run')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(403);
    });

    it('denies clinic admin on POST /audit/monitoring/run-checks', async () => {
      await request(app.getHttpServer())
        .post('/audit/monitoring/run-checks')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(403);
    });

    it.each(platformRoutes)('allows back office staff on GET %s', async (route) => {
      await request(app.getHttpServer())
        .get(route)
        .set('Authorization', `Bearer ${backofficeToken}`)
        .expect(200);
    });
  });

  describe('Back office staff on clinic-scoped endpoints', () => {
    it('denies back office staff on GET /audit/events', async () => {
      // The clinic-scoped listing requires the clinic admin role; staff use
      // /backoffice/audit/events instead.
      await request(app.getHttpServer())
        .get('/audit/events')
        .set('Authorization', `Bearer ${backofficeToken}`)
        .expect(403);
    });
  });
});
