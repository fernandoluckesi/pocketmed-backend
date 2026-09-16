/**
 * Reproduces the reported bug: attached files disappear from the doctor's list
 * and never reach the back office reviewer.
 *
 * Root cause under test: UploadService.uploadFile returns an EMPTY STRING when
 * storage is not configured, instead of throwing. The document row was then
 * saved with fileUrl = '', so the API reported the file as "uploaded" while
 * there was nothing to open — and the reviewer had no file to analyse.
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
import { DoctorDocumentsModule } from '../src/doctor-documents/doctor-documents.module';
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
import { Clinic } from '../src/entities/clinic.entity';
import { ClinicMembership } from '../src/entities/clinic-membership.entity';
import { ClinicAdminProfile } from '../src/entities/clinic-admin-profile.entity';
import { SecretaryProfile } from '../src/entities/secretary-profile.entity';
import { Secretary } from '../src/entities/secretary.entity';
import { Notification } from '../src/entities/notification.entity';
import { DeviceToken } from '../src/entities/device-token.entity';
import { BackofficeUser } from '../src/entities/backoffice-user.entity';
import { ProfessionalRole } from '../src/auth/professional-role.enum';

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
  Notification,
  DeviceToken,
  BackofficeUser,
  AuditEvent,
];

describe('Document upload with unavailable storage (e2e)', () => {
  let app: INestApplication;
  let doctorToken: string;
  let doctorId: string;
  let documentRepository: Repository<DoctorDocument>;

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
        DoctorDocumentsModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: BackofficeBoundaryGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    })
      // Simulates storage not configured: the real service returns '' here.
      .overrideProvider(UploadService)
      .useValue({
        uploadFile: jest.fn().mockResolvedValue(''),
        deleteFile: jest.fn(),
        onModuleInit: jest.fn(),
      })
      .overrideProvider(EmailService)
      .useValue({ sendVerificationCode: jest.fn() })
      .overrideProvider(NotificationsService)
      .useValue({ createNotification: jest.fn().mockResolvedValue({ id: 'n1' }) })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
    );
    await app.init();

    const auditRepository: Repository<AuditEvent> = app.get(getRepositoryToken(AuditEvent));
    for (const column of auditRepository.manager.connection.getMetadata(AuditEvent).columns) {
      if (['changedFields', 'metadata'].includes(column.propertyName)) {
        column.transformer = {
          to: (v: unknown) => (v === null || v === undefined ? v : JSON.stringify(v)),
          from: (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v),
        } as never;
      }
    }

    documentRepository = app.get(getRepositoryToken(DoctorDocument));
    const doctorRepository: Repository<Doctor> = app.get(getRepositoryToken(Doctor));

    const doctor = await doctorRepository.save(
      doctorRepository.create({
        name: 'Dr. Storage',
        email: 'storage@test.com',
        password: 'hashed',
        type: 'doctor',
        gender: 'Masculino',
        specialty: 'Clínica Geral',
        cpf: '77777777777',
        phone: '(11) 90000-0007',
        birthDate: new Date('1980-07-07'),
        crm: '777777/SP',
      } as Partial<Doctor>),
    );
    doctorId = doctor.id;

    doctorToken = app.get(JwtService).sign({
      sub: doctor.id,
      email: doctor.email,
      type: 'doctor',
      role: ProfessionalRole.DOCTOR,
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('fails loudly instead of saving a document without a file URL', async () => {
    const res = await request(app.getHttpServer())
      .post('/doctors/documents/CIM')
      .set('Authorization', `Bearer ${doctorToken}`)
      .attach('file', Buffer.from('conteudo-pdf'), 'cim.pdf');

    // Must NOT report success when the file was not actually stored.
    expect(res.status).toBeGreaterThanOrEqual(400);

    // And must not leave a half-saved row behind.
    const docs = await documentRepository.find({ where: { doctorId } });
    expect(docs).toHaveLength(0);
  });

  it('keeps the doctor status clean after a failed upload', async () => {
    const res = await request(app.getHttpServer())
      .get('/doctors/documents/status')
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const cim = res.body.documents.find((d: { type: string }) => d.type === 'CIM');
    expect(cim.uploaded).toBe(false);
    expect(cim.status).toBe('NOT_UPLOADED');
  });
});
