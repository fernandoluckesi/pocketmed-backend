import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';

// Entities
import { Patient } from '../src/entities/patient.entity';
import { Doctor } from '../src/entities/doctor.entity';
import { Dependent } from '../src/entities/dependent.entity';
import { Appointment } from '../src/entities/appointment.entity';
import { Medication } from '../src/entities/medication.entity';
import { Exam } from '../src/entities/exam.entity';
import { DoctorAccessRequest } from '../src/entities/doctor-access-request.entity';
import { DoctorPermission } from '../src/entities/doctor-permission.entity';
import { AvailabilityRule } from '../src/entities/availability-rule.entity';
import { AvailabilityException } from '../src/entities/availability-exception.entity';
import { DeviceToken } from '../src/entities/device-token.entity';
import { Notification } from '../src/entities/notification.entity';
import { Clinic } from '../src/entities/clinic.entity';
import { ClinicMembership } from '../src/entities/clinic-membership.entity';
import { ClinicAdminProfile } from '../src/entities/clinic-admin-profile.entity';
import { SecretaryProfile } from '../src/entities/secretary-profile.entity';
import { ExamCategory } from '../src/entities/exam-category.entity';
import { ExamCatalog } from '../src/entities/exam-catalog.entity';
import { ExamSchedule } from '../src/entities/exam-schedule.entity';
import { ExamScheduleItem } from '../src/entities/exam-schedule-item.entity';

// Modules
import { AuthModule } from '../src/auth/auth.module';
import { ExamCatalogModule } from '../src/exam-catalog/exam-catalog.module';
import { ExamSchedulingModule } from '../src/exam-scheduling/exam-scheduling.module';
import { AppointmentsModule } from '../src/appointments/appointments.module';
import { DoctorsModule } from '../src/doctors/doctors.module';
import { PatientsModule } from '../src/patients/patients.module';
import { NotificationsModule } from '../src/notifications/notifications.module';

// Guards
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';

// Services to mock
import { UploadService } from '../src/upload/upload.service';
import { EmailService } from '../src/email/email.service';
import { NotificationsService } from '../src/notifications/notifications.service';

/**
 * All entities used in the application.
 * SQLite will create tables via synchronize: true.
 */
export const ALL_ENTITIES = [
  Patient,
  Doctor,
  Dependent,
  Appointment,
  Medication,
  Exam,
  DoctorAccessRequest,
  DoctorPermission,
  AvailabilityRule,
  AvailabilityException,
  DeviceToken,
  Notification,
  Clinic,
  ClinicMembership,
  ClinicAdminProfile,
  SecretaryProfile,
  ExamCategory,
  ExamCatalog,
  ExamSchedule,
  ExamScheduleItem,
];

/**
 * Mock UploadService — no-op for tests
 */
export const mockUploadService = {
  uploadFile: jest.fn().mockResolvedValue(null),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  onModuleInit: jest.fn().mockResolvedValue(undefined),
};

/**
 * Mock EmailService — no-op for tests
 */
export const mockEmailService = {
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
};

/**
 * Mock NotificationsService — no-op for tests
 */
export const mockNotificationsService = {
  createNotification: jest.fn().mockResolvedValue({ id: 'mock-notification-id' }),
  sendPushToUser: jest.fn().mockResolvedValue(undefined),
  syncAccessRequestNotificationStatus: jest.fn().mockResolvedValue(undefined),
  syncAppointmentCompletionNotificationStatus: jest.fn().mockResolvedValue(undefined),
  registerToken: jest.fn().mockResolvedValue(undefined),
  unregisterToken: jest.fn().mockResolvedValue(undefined),
  getNotificationsForUser: jest.fn().mockResolvedValue([]),
  getUnreadCountForUser: jest.fn().mockResolvedValue(0),
  markAsRead: jest.fn().mockResolvedValue(undefined),
  markAllAsRead: jest.fn().mockResolvedValue(undefined),
};

/**
 * Creates a fully configured NestJS test application with SQLite in-memory DB.
 * Includes Auth, ExamCatalog, ExamScheduling, Appointments modules.
 *
 * Uses a workaround to handle enum columns: patches TypeORM's metadata args
 * to replace 'enum' with 'text' before DataSource initialization.
 */
export async function createTestApp(): Promise<INestApplication> {
  // Monkey-patch TypeORM's MetadataArgsStorage to convert enum columns to text
  // This must happen before DataSource initialization
  const { getMetadataArgsStorage } = require('typeorm');
  const metadataArgsStorage = getMetadataArgsStorage();

  // Patch all column metadata args that use enum type
  for (const column of metadataArgsStorage.columns) {
    if (column.options && column.options.type === 'enum') {
      column.options.type = 'varchar';
      column.options.length = 100;
      delete column.options.enum;
      delete column.options.enumName;
    }
    // Also patch json columns for SQLite compatibility
    if (column.options && column.options.type === 'json') {
      column.options.type = 'text';
    }
    // Patch timestamp columns — SQLite uses 'datetime' instead
    if (column.options && column.options.type === 'timestamp') {
      column.options.type = 'datetime';
    }
    // Patch decimal columns — SQLite uses 'real'
    if (column.options && column.options.type === 'decimal') {
      column.options.type = 'real';
    }
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
        entities: ALL_ENTITIES,
        synchronize: true,
        dropSchema: true,
      }),
      TypeOrmModule.forFeature(ALL_ENTITIES),
      PassportModule,
      JwtModule.register({
        secret: 'test-jwt-secret-key-for-integration-tests',
        signOptions: { expiresIn: '1h' },
      }),
      AuthModule,
      ExamCatalogModule,
      ExamSchedulingModule,
      AppointmentsModule,
      DoctorsModule,
      PatientsModule,
      NotificationsModule,
    ],
    providers: [
      {
        provide: APP_GUARD,
        useClass: JwtAuthGuard,
      },
      {
        provide: APP_GUARD,
        useClass: RolesGuard,
      },
    ],
  })
    .overrideProvider(UploadService)
    .useValue(mockUploadService)
    .overrideProvider(EmailService)
    .useValue(mockEmailService)
    .overrideProvider(NotificationsService)
    .useValue(mockNotificationsService)
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
  return app;
}

/**
 * Register a patient and return the response body (user + token).
 */
export async function registerPatient(
  app: INestApplication,
  overrides: Partial<{
    name: string;
    email: string;
    password: string;
    gender: string;
    phone: string;
    birthDate: string;
  }> = {},
) {
  const data = {
    name: overrides.name || 'Test Patient',
    email: overrides.email || `patient-${Date.now()}@test.com`,
    password: overrides.password || 'password123',
    gender: overrides.gender || 'Masculino',
    phone: overrides.phone || '(11) 99999-0000',
    birthDate: overrides.birthDate || '1990-01-15',
  };

  const res = await request(app.getHttpServer())
    .post('/auth/register/patient')
    .send(data)
    .expect(201);

  return res.body;
}

/**
 * Register a doctor and return the response body (user + token).
 */
export async function registerDoctor(
  app: INestApplication,
  overrides: Partial<{
    name: string;
    email: string;
    password: string;
    gender: string;
    specialty: string;
    cpf: string;
    phone: string;
    birthDate: string;
    crm: string;
  }> = {},
) {
  const data = {
    name: overrides.name || 'Dr. Test Doctor',
    email: overrides.email || `doctor-${Date.now()}@test.com`,
    password: overrides.password || 'password123',
    gender: overrides.gender || 'Masculino',
    specialty: overrides.specialty || 'Cardiologia',
    cpf: overrides.cpf || `${Date.now()}`.slice(-11).padStart(11, '0'),
    phone: overrides.phone || '(11) 99999-1111',
    birthDate: overrides.birthDate || '1985-05-20',
    crm: overrides.crm || `${Date.now() % 999999}/SP`,
  };

  const res = await request(app.getHttpServer())
    .post('/auth/register/doctor')
    .send(data)
    .expect(201);

  return res.body;
}

/**
 * Login and return the response body (user + token).
 */
export async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
) {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  return res.body;
}

/**
 * Get a future ISO date string (days from now).
 */
export function futureDate(daysFromNow: number = 7): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

/**
 * Get a past ISO date string (days ago).
 */
export function pastDate(daysAgo: number = 7): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}
