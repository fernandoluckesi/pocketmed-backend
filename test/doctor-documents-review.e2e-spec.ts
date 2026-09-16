/**
 * Document submission + review lifecycle.
 *
 * Pins the rules agreed for this flow:
 * - a document under review cannot be replaced (locked until there is feedback)
 * - a rejected/approved document CAN be replaced (goes back to PENDING)
 * - the back office queue is driven by documents, so a doctor with only some
 *   files uploaded still shows up for review
 * - review decisions notify the doctor
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
import { BackofficeUser, BackofficeRole } from '../src/entities/backoffice-user.entity';
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

describe('Doctor documents review lifecycle (e2e)', () => {
  let app: INestApplication;
  let doctorToken: string;
  let backofficeToken: string;
  let doctorId: string;
  let documentRepository: Repository<DoctorDocument>;
  let doctorRepository: Repository<Doctor>;
  const notifications = { createNotification: jest.fn().mockResolvedValue({ id: 'n1' }) };

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
        // Returns a deterministic URL so assertions can rely on it.
        uploadFile: jest
          .fn()
          .mockImplementation((_f: unknown, folder: string) =>
            Promise.resolve(`https://storage.test/${folder}/file.pdf`),
          ),
        deleteFile: jest.fn().mockResolvedValue(undefined),
        onModuleInit: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(EmailService)
      .useValue({
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

    documentRepository = app.get(getRepositoryToken(DoctorDocument));
    doctorRepository = app.get(getRepositoryToken(Doctor));
    const backofficeRepository: Repository<BackofficeUser> = app.get(
      getRepositoryToken(BackofficeUser),
    );

    const doctor = await doctorRepository.save(
      doctorRepository.create({
        name: 'Dra. Documentos',
        email: 'docs@test.com',
        password: 'hashed',
        type: 'doctor',
        gender: 'Feminino',
        specialty: 'Cardiologia',
        cpf: '55555555555',
        phone: '(11) 90000-0005',
        birthDate: new Date('1985-05-05'),
        crm: '555555/SP',
      } as Partial<Doctor>),
    );
    doctorId = doctor.id;

    const staff = await backofficeRepository.save(
      backofficeRepository.create({
        name: 'Staff',
        email: 'staff-docs@hispora.com',
        password: 'hashed',
        backofficeRole: BackofficeRole.ANALYST,
        isActive: true,
      } as Partial<BackofficeUser>),
    );

    const jwtService = app.get(JwtService);
    doctorToken = jwtService.sign({
      sub: doctor.id,
      email: doctor.email,
      type: 'doctor',
      role: ProfessionalRole.DOCTOR,
    });
    backofficeToken = jwtService.sign({
      sub: staff.id,
      email: staff.email,
      type: 'backoffice',
      role: BackofficeRole.ANALYST,
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  function uploadCim() {
    return request(app.getHttpServer())
      .post('/doctors/documents/CIM')
      .set('Authorization', `Bearer ${doctorToken}`)
      .attach('file', Buffer.from('conteudo-pdf'), 'cim.pdf');
  }

  it('accepts the first upload and marks it as PENDING', async () => {
    await uploadCim().expect(201);

    const res = await request(app.getHttpServer())
      .get('/doctors/documents/status')
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const cim = res.body.documents.find((d: { type: string }) => d.type === 'CIM');
    expect(cim.uploaded).toBe(true);
    expect(cim.status).toBe('PENDING');
    // Under review → locked for replacement.
    expect(cim.canReplace).toBe(false);
  });

  it('lists the doctor in the review queue even with only 1 of 4 documents', async () => {
    // Regression: the queue used to filter by the doctor's overall status, so a
    // partial submission was invisible to the reviewer.
    const res = await request(app.getHttpServer())
      .get('/backoffice/doctor-verification/submissions?status=SUBMITTED')
      .set('Authorization', `Bearer ${backofficeToken}`)
      .expect(200);

    const ids = res.body.data.map((d: { id: string }) => d.id);
    expect(ids).toContain(doctorId);
  });

  it('blocks replacing a document that is under review', async () => {
    const res = await uploadCim().expect(400);
    expect(res.body.message).toContain('está em análise');
  });

  it('notifies the doctor when a document is rejected', async () => {
    notifications.createNotification.mockClear();

    const cim = await documentRepository.findOne({ where: { doctorId, type: 'CIM' } });
    await request(app.getHttpServer())
      .patch(`/backoffice/doctor-verification/documents/${cim!.id}/reject`)
      .set('Authorization', `Bearer ${backofficeToken}`)
      .send({ rejectionReason: 'Imagem ilegível, reenvie com melhor resolução.' })
      .expect(200);

    expect(notifications.createNotification).toHaveBeenCalledTimes(1);
    const [, , title, , type] = notifications.createNotification.mock.calls[0];
    expect(title).toBe('Documento não aprovado');
    expect(type).toBe('DOCTOR_DOCUMENT_REJECTED');

    const updated = await doctorRepository.findOne({ where: { id: doctorId } });
    expect(updated!.verificationStatus).toBe('REJECTED');
  });

  it('exposes the rejection reason to the doctor', async () => {
    const res = await request(app.getHttpServer())
      .get('/doctors/documents/status')
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const cim = res.body.documents.find((d: { type: string }) => d.type === 'CIM');
    expect(cim.status).toBe('REJECTED');
    expect(cim.rejectionReason).toContain('ilegível');
    // Rejected → the doctor may now resend.
    expect(cim.canReplace).toBe(true);
  });

  it('allows resubmitting a rejected document and puts it back under review', async () => {
    await uploadCim().expect(201);

    const res = await request(app.getHttpServer())
      .get('/doctors/documents/status')
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const cim = res.body.documents.find((d: { type: string }) => d.type === 'CIM');
    expect(cim.status).toBe('PENDING');
    expect(cim.rejectionReason).toBeNull();
    expect(cim.canReplace).toBe(false);
  });

  it('notifies verification completion once every document is approved', async () => {
    // Upload the remaining three documents.
    for (const type of ['DIPLOMA', 'REGULARIDADE', 'RQE']) {
      await request(app.getHttpServer())
        .post(`/doctors/documents/${type}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .attach('file', Buffer.from('conteudo'), `${type.toLowerCase()}.pdf`)
        .expect(201);
    }

    notifications.createNotification.mockClear();

    const docs = await documentRepository.find({ where: { doctorId } });
    for (const doc of docs) {
      await request(app.getHttpServer())
        .patch(`/backoffice/doctor-verification/documents/${doc.id}/approve`)
        .set('Authorization', `Bearer ${backofficeToken}`)
        .send({})
        .expect(200);
    }

    const updated = await doctorRepository.findOne({ where: { id: doctorId } });
    expect(updated!.verificationStatus).toBe('APPROVED');

    const types = notifications.createNotification.mock.calls.map((c) => c[4]);
    expect(types).toContain('DOCTOR_VERIFICATION_APPROVED');
  });

  it('allows replacing an approved document (e.g. renewed CRM)', async () => {
    await uploadCim().expect(201);

    const res = await request(app.getHttpServer())
      .get('/doctors/documents/status')
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const cim = res.body.documents.find((d: { type: string }) => d.type === 'CIM');
    expect(cim.status).toBe('PENDING');
    // Overall status drops back to SUBMITTED while the new file is reviewed.
    expect(res.body.verificationStatus).toBe('SUBMITTED');
  });
});
