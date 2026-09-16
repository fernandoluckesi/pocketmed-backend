/**
 * Product-boundary tests.
 *
 * The API serves two separate products (clinical platform and internal back
 * office). These tests assert the boundary holds in BOTH directions:
 *
 * - A back office token cannot reach clinical routes — notably controllers that
 *   declare no `@Roles`, such as `/patients`.
 * - A clinical token (doctor / clinic admin / secretary) cannot reach
 *   `/backoffice/*`.
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

import { AuthModule } from '../src/auth/auth.module';
import { AuditModule } from '../src/audit/audit.module';
import { BackofficeModule } from '../src/backoffice/backoffice.module';
import { PatientsModule } from '../src/patients/patients.module';
import { AuditEvent } from '../src/audit/entities/audit-event.entity';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { BackofficeBoundaryGuard } from '../src/auth/guards/backoffice-boundary.guard';
import { UploadService } from '../src/upload/upload.service';
import { EmailService } from '../src/email/email.service';
import { NotificationsService } from '../src/notifications/notifications.service';

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
import { PatientAccessLog } from '../src/entities/patient-access-log.entity';
import { PatientDisease } from '../src/entities/patient-disease.entity';
import { PatientAllergy } from '../src/entities/patient-allergy.entity';
import { PatientVaccine } from '../src/entities/patient-vaccine.entity';
import { PatientSurgery } from '../src/entities/patient-surgery.entity';
import { Clinic } from '../src/entities/clinic.entity';
import { ClinicMembership } from '../src/entities/clinic-membership.entity';
import { ClinicAdminProfile } from '../src/entities/clinic-admin-profile.entity';
import { SecretaryProfile } from '../src/entities/secretary-profile.entity';
import { Secretary } from '../src/entities/secretary.entity';
import { Notification } from '../src/entities/notification.entity';
import { DeviceToken } from '../src/entities/device-token.entity';
import { BackofficeUser, BackofficeRole } from '../src/entities/backoffice-user.entity';
import { ProfessionalRole } from '../src/auth/professional-role.enum';

const CLINIC_ID = '33333333-3333-3333-3333-333333333333';

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
  PatientAccessLog,
  PatientDisease,
  PatientAllergy,
  PatientVaccine,
  PatientSurgery,
  Clinic,
  ClinicMembership,
  ClinicAdminProfile,
  SecretaryProfile,
  Secretary,
  Notification,
  DeviceToken,
  BackofficeUser,
  AuditEvent,
];

describe('Backoffice product boundary (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  let doctorToken: string;
  let adminToken: string;
  let backofficeToken: string;

  beforeAll(async () => {
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
        PatientsModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: BackofficeBoundaryGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    })
      .overrideProvider(UploadService)
      .useValue({
        uploadFile: jest.fn().mockResolvedValue(null),
        deleteFile: jest.fn().mockResolvedValue(undefined),
        onModuleInit: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(EmailService)
      .useValue({
        sendDocumentRejectedNotice: jest.fn().mockResolvedValue(undefined),
        sendDocumentApprovedNotice: jest.fn().mockResolvedValue(undefined),
        sendVerificationApprovedNotice: jest.fn().mockResolvedValue(undefined),
        sendVerificationCode: jest.fn().mockResolvedValue(undefined),
        sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(NotificationsService)
      .useValue({
        createNotification: jest.fn().mockResolvedValue({ id: 'n1' }),
        sendPushToUser: jest.fn().mockResolvedValue(undefined),
      })
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

    // The `json` columns are downgraded to `text` for SQLite, so TypeORM does not
    // serialize objects automatically. Stringify them on write to keep the
    // in-memory harness working; MySQL handles this natively in production.
    const auditRepository: Repository<AuditEvent> = app.get(getRepositoryToken(AuditEvent));
    for (const column of auditRepository.manager.connection.getMetadata(AuditEvent).columns) {
      if (['changedFields', 'metadata'].includes(column.propertyName)) {
        column.transformer = {
          to: (value: unknown) =>
            value === null || value === undefined ? value : JSON.stringify(value),
          from: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
        } as never;
      }
    }

    const doctorRepository: Repository<Doctor> = app.get(getRepositoryToken(Doctor));
    const clinicRepository: Repository<Clinic> = app.get(getRepositoryToken(Clinic));
    const membershipRepository: Repository<ClinicMembership> = app.get(
      getRepositoryToken(ClinicMembership),
    );
    const backofficeRepository: Repository<BackofficeUser> = app.get(
      getRepositoryToken(BackofficeUser),
    );

    await clinicRepository.save(
      clinicRepository.create({ id: CLINIC_ID, name: 'Clínica Teste', isActive: true }),
    );

    const doctor = await doctorRepository.save(
      doctorRepository.create({
        name: 'Dr. Teste',
        email: 'doctor-boundary@test.com',
        password: 'hashed',
        type: 'doctor',
        gender: 'Masculino',
        specialty: 'Clínica Geral',
        cpf: '33333333333',
        phone: '(11) 90000-0003',
        birthDate: new Date('1980-03-03'),
        crm: '333333/SP',
      } as Partial<Doctor>),
    );

    const admin = await doctorRepository.save(
      doctorRepository.create({
        name: 'Admin Clinica',
        email: 'admin-boundary@test.com',
        password: 'hashed',
        type: 'doctor',
        gender: 'Feminino',
        specialty: 'Clínica Geral',
        cpf: '44444444444',
        phone: '(11) 90000-0004',
        birthDate: new Date('1980-04-04'),
        crm: '444444/SP',
      } as Partial<Doctor>),
    );

    await membershipRepository.save(
      membershipRepository.create({
        clinicId: CLINIC_ID,
        professionalId: admin.id,
        role: ProfessionalRole.ADMIN,
        isActive: true,
      } as Partial<ClinicMembership>),
    );

    const staff = await backofficeRepository.save(
      backofficeRepository.create({
        name: 'Staff Hispora',
        email: 'staff-boundary@hispora.com',
        password: 'hashed',
        backofficeRole: BackofficeRole.SUPERADMIN,
        isActive: true,
      } as Partial<BackofficeUser>),
    );

    doctorToken = jwtService.sign({
      sub: doctor.id,
      email: doctor.email,
      type: 'doctor',
      role: ProfessionalRole.DOCTOR,
    });
    adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      type: 'doctor',
      role: ProfessionalRole.ADMIN,
      activeClinicId: CLINIC_ID,
    });
    backofficeToken = jwtService.sign({
      sub: staff.id,
      email: staff.email,
      type: 'backoffice',
      role: BackofficeRole.SUPERADMIN,
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Back office token must not reach clinical routes', () => {
    /**
     * `/patients` declares no `@Roles`, so the RolesGuard lets it through; today
     * PatientsService also rejects non-doctor types on its own. These tests pin
     * the behaviour at the HTTP boundary so the isolation cannot regress if a
     * service-level check is ever relaxed or a new route forgets `@Roles`.
     */
    it('blocks GET /patients', async () => {
      await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${backofficeToken}`)
        .expect(403);
    });

    it('blocks GET /patients/search', async () => {
      await request(app.getHttpServer())
        .get('/patients/search?q=ana')
        .set('Authorization', `Bearer ${backofficeToken}`)
        .expect(403);
    });

    it('reports the boundary as the reason, not a service-level check', async () => {
      const res = await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${backofficeToken}`)
        .expect(403);

      expect(res.body.message).toBe('Contas de backoffice só podem acessar recursos do backoffice.');
    });
  });

  describe('Clinical tokens must not reach back office routes', () => {
    const backofficeRoutes = [
      '/backoffice/doctor-verification/stats',
      '/backoffice/doctor-verification/submissions',
      '/backoffice/audit/events',
    ];

    it.each(backofficeRoutes)('blocks clinic admin on GET %s', async (route) => {
      await request(app.getHttpServer())
        .get(route)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it.each(backofficeRoutes)('blocks plain doctor on GET %s', async (route) => {
      await request(app.getHttpServer())
        .get(route)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(403);
    });

    it('blocks clinic admin from approving a document', async () => {
      await request(app.getHttpServer())
        .patch('/backoffice/doctor-verification/documents/any-id/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(403);
    });
  });

  describe('Back office token works on its own routes', () => {
    it('allows GET /backoffice/doctor-verification/stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/backoffice/doctor-verification/stats')
        .set('Authorization', `Bearer ${backofficeToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('submitted');
    });

    it('allows GET /backoffice/doctor-verification/submissions', async () => {
      const res = await request(app.getHttpServer())
        .get('/backoffice/doctor-verification/submissions')
        .set('Authorization', `Bearer ${backofficeToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Back office login stays public', () => {
    it('rejects wrong credentials with a generic 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/backoffice/auth/login')
        .send({ email: 'staff-boundary@hispora.com', password: 'wrong-password' })
        .expect(401);

      expect(res.body.message).toBe('Email ou senha inválidos.');
    });

    it('returns the same generic error for an unknown email', async () => {
      const res = await request(app.getHttpServer())
        .post('/backoffice/auth/login')
        .send({ email: 'does-not-exist@hispora.com', password: 'whatever123' })
        .expect(401);

      // No account enumeration: identical message for unknown vs wrong password.
      expect(res.body.message).toBe('Email ou senha inválidos.');
    });
  });
});
