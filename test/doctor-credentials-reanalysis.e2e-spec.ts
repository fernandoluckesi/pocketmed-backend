/**
 * Credential changes reopen the verification.
 *
 * CRM / RQE / specialty were validated against the approved documents, so
 * changing them must send the doctor back to review instead of keeping an
 * "approved" badge for data nobody checked.
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

const DOC_TYPES = ['CIM', 'DIPLOMA', 'REGULARIDADE', 'RQE'];

describe('Credential change reopens verification (e2e)', () => {
  let app: INestApplication;
  let doctorToken: string;
  let doctorId: string;
  let doctorRepository: Repository<Doctor>;
  let documentRepository: Repository<DoctorDocument>;
  const notifications = { createNotification: jest.fn().mockResolvedValue({ id: 'n1' }) };

  /** Puts the doctor in a fully APPROVED state, as if review had finished. */
  async function setApprovedState() {
    await documentRepository.delete({ doctorId });
    for (const type of DOC_TYPES) {
      await documentRepository.save(
        documentRepository.create({
          doctorId,
          type,
          fileUrl: `https://storage.test/${type}.pdf`,
          originalFileName: `${type}.pdf`,
          status: 'APPROVED',
        } as Partial<DoctorDocument>),
      );
    }
    await doctorRepository.update(doctorId, { verificationStatus: 'APPROVED' });
  }

  /** Profile updates on sensitive fields require an emailed code. */
  async function primeVerificationCode(code: string) {
    await doctorRepository.update(doctorId, {
      verificationCode: code,
      verificationCodeExpiry: new Date(Date.now() + 15 * 60 * 1000),
    });
  }

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
      .overrideProvider(UploadService)
      .useValue({
        uploadFile: jest.fn().mockResolvedValue('https://storage.test/file.pdf'),
        deleteFile: jest.fn(),
        onModuleInit: jest.fn(),
      })
      .overrideProvider(EmailService)
      .useValue({
        sendVerificationCode: jest.fn().mockResolvedValue(undefined),
        sendDocumentRejectedNotice: jest.fn().mockResolvedValue(undefined),
        sendDocumentApprovedNotice: jest.fn().mockResolvedValue(undefined),
        sendVerificationApprovedNotice: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(NotificationsService)
      .useValue(notifications)
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

    doctorRepository = app.get(getRepositoryToken(Doctor));
    documentRepository = app.get(getRepositoryToken(DoctorDocument));

    const doctor = await doctorRepository.save(
      doctorRepository.create({
        name: 'Dr. Credenciais',
        email: 'cred@test.com',
        password: 'hashed',
        type: 'doctor',
        gender: 'Masculino',
        specialty: 'Cardiologia',
        cpf: '66666666666',
        phone: '(11) 90000-0006',
        birthDate: new Date('1980-06-06'),
        crm: '666666/SP',
        rqe: '111',
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

  it('reopens verification and resets documents when the CRM changes', async () => {
    await setApprovedState();
    await primeVerificationCode('123456');
    notifications.createNotification.mockClear();

    const res = await request(app.getHttpServer())
      .patch('/auth/profile')
      .set('Authorization', `Bearer ${doctorToken}`)
      .field('crm', '777777/SP')
      .field('verificationCode', '123456')
      .expect(200);

    expect(res.body.verificationReopened).toBe(true);
    expect(res.body.verificationStatus).toBe('SUBMITTED');

    const doctor = await doctorRepository.findOne({ where: { id: doctorId } });
    expect(doctor!.crm).toBe('777777/SP');
    expect(doctor!.verificationStatus).toBe('SUBMITTED');

    // Previously approved documents go back to review.
    const docs = await documentRepository.find({ where: { doctorId } });
    expect(docs).toHaveLength(DOC_TYPES.length);
    expect(docs.every((d) => d.status === 'PENDING')).toBe(true);

    const types = notifications.createNotification.mock.calls.map((c) => c[4]);
    expect(types).toContain('DOCTOR_VERIFICATION_REOPENED');
  });

  it('reopens verification when the RQE changes', async () => {
    await setApprovedState();
    await primeVerificationCode('222222');

    const res = await request(app.getHttpServer())
      .patch('/auth/profile')
      .set('Authorization', `Bearer ${doctorToken}`)
      .field('rqe', '999')
      .field('verificationCode', '222222')
      .expect(200);

    expect(res.body.verificationReopened).toBe(true);
  });

  it('reopens verification when the specialty changes', async () => {
    await setApprovedState();
    await primeVerificationCode('333333');

    const res = await request(app.getHttpServer())
      .patch('/auth/profile')
      .set('Authorization', `Bearer ${doctorToken}`)
      .field('specialty', 'Neurologia')
      .field('verificationCode', '333333')
      .expect(200);

    expect(res.body.verificationReopened).toBe(true);
  });

  it('does NOT reopen when only the name changes', async () => {
    await setApprovedState();

    // Name/photo are low-risk and need no verification code.
    const res = await request(app.getHttpServer())
      .patch('/auth/profile')
      .set('Authorization', `Bearer ${doctorToken}`)
      .field('name', 'Dr. Credenciais Junior')
      .expect(200);

    expect(res.body.verificationReopened).toBe(false);

    const doctor = await doctorRepository.findOne({ where: { id: doctorId } });
    expect(doctor!.verificationStatus).toBe('APPROVED');

    const docs = await documentRepository.find({ where: { doctorId } });
    expect(docs.every((d) => d.status === 'APPROVED')).toBe(true);
  });

  it('does NOT reopen when the CRM is submitted unchanged', async () => {
    await setApprovedState();
    const current = await doctorRepository.findOne({ where: { id: doctorId } });
    await primeVerificationCode('444444');

    const res = await request(app.getHttpServer())
      .patch('/auth/profile')
      .set('Authorization', `Bearer ${doctorToken}`)
      .field('crm', current!.crm)
      .field('verificationCode', '444444')
      .expect(200);

    // Saving the same value must not disturb an approved verification.
    expect(res.body.verificationReopened).toBe(false);
    expect(res.body.verificationStatus).toBe('APPROVED');
  });
});
