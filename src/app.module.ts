import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patients/patients.module';
import { DependentsModule } from './dependents/dependents.module';
import { DoctorsModule } from './doctors/doctors.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { MedicationsModule } from './medications/medications.module';
import { ExamsModule } from './exams/exams.module';
import { AvailabilityModule } from './availability/availability.module';
import { UploadModule } from './upload/upload.module';
import { EmailModule } from './email/email.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Patient } from './entities/patient.entity';
import { Doctor } from './entities/doctor.entity';
import { Dependent } from './entities/dependent.entity';
import { Appointment } from './entities/appointment.entity';
import { Medication } from './entities/medication.entity';
import { Exam } from './entities/exam.entity';
import { DoctorAccessRequest } from './entities/doctor-access-request.entity';
import { DoctorPermission } from './entities/doctor-permission.entity';
import { AvailabilityRule } from './entities/availability-rule.entity';
import { AvailabilityException } from './entities/availability-exception.entity';
import { DeviceToken } from './entities/device-token.entity';
import { Notification } from './entities/notification.entity';
import { Clinic } from './entities/clinic.entity';
import { ClinicMembership } from './entities/clinic-membership.entity';
import { ClinicAdminProfile } from './entities/clinic-admin-profile.entity';
import { SecretaryProfile } from './entities/secretary-profile.entity';
import { ExamCategory } from './entities/exam-category.entity';
import { ExamCatalog } from './entities/exam-catalog.entity';
import { ExamSchedule } from './entities/exam-schedule.entity';
import { ExamScheduleItem } from './entities/exam-schedule-item.entity';
import { DoctorDocument } from './entities/doctor-document.entity';
import { FinancialSettings } from './entities/financial-settings.entity';
import { FinancialCostCenter } from './entities/financial-cost-center.entity';
import { FinancialConvenio } from './entities/financial-convenio.entity';
import { FinancialRevenue } from './entities/financial-revenue.entity';
import { FinancialExpense } from './entities/financial-expense.entity';
import { FinancialDoctorTransfer } from './entities/financial-doctor-transfer.entity';
import { FinancialCashflowEntry } from './entities/financial-cashflow-entry.entity';
import { PatientAccessLog } from './entities/patient-access-log.entity';
import { NotificationsModule } from './notifications/notifications.module';
import { ClinicAdminModule } from './clinic-admin/clinic-admin.module';
import { ExamCatalogModule } from './exam-catalog/exam-catalog.module';
import { ExamSchedulingModule } from './exam-scheduling/exam-scheduling.module';
import { DoctorDocumentsModule } from './doctor-documents/doctor-documents.module';
import { FinancialModule } from './financial/financial.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        // Support both DB_* (manual) and MYSQL_* (Railway auto-injected) variable names
        host: configService.get<string>('DB_HOST') || configService.get<string>('MYSQL_HOST') || configService.get<string>('MYSQLHOST'),
        port: configService.get<number>('DB_PORT') || configService.get<number>('MYSQL_PORT') || configService.get<number>('MYSQLPORT') || 3306,
        username: configService.get<string>('DB_USERNAME') || configService.get<string>('MYSQL_USER') || configService.get<string>('MYSQLUSER'),
        password: configService.get<string>('DB_PASSWORD') || configService.get<string>('MYSQL_PASSWORD') || configService.get<string>('MYSQLPASSWORD'),
        database: configService.get<string>('DB_DATABASE') || configService.get<string>('MYSQL_DATABASE') || configService.get<string>('MYSQLDATABASE'),
        // Retry connection on startup (Railway DB may not be immediately available)
        retryAttempts: 10,
        retryDelay: 3000,
        connectTimeout: 20000,
        entities: [
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
          DoctorDocument,
          FinancialSettings,
          FinancialCostCenter,
          FinancialConvenio,
          FinancialRevenue,
          FinancialExpense,
          FinancialDoctorTransfer,
          FinancialCashflowEntry,
          PatientAccessLog,
        ],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: false,
        logging: false,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    PatientsModule,
    DependentsModule,
    DoctorsModule,
    AppointmentsModule,
    MedicationsModule,
    ExamsModule,
    AvailabilityModule,
    UploadModule,
    EmailModule,
    NotificationsModule,
    ClinicAdminModule,
    ExamCatalogModule,
    ExamSchedulingModule,
    DoctorDocumentsModule,
    FinancialModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
export class AppModule {}
