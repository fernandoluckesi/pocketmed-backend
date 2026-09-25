import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { Doctor } from '../entities/doctor.entity';
import { Dependent } from '../entities/dependent.entity';
import { Appointment } from '../entities/appointment.entity';
import { Medication } from '../entities/medication.entity';
import { Exam } from '../entities/exam.entity';
import { DoctorAccessRequest } from '../entities/doctor-access-request.entity';
import { DoctorPermission } from '../entities/doctor-permission.entity';
import { DependentResponsibleInvite } from '../entities/dependent-responsible-invite.entity';
import { DeviceToken } from '../entities/device-token.entity';
import { Notification } from '../entities/notification.entity';
import { Clinic } from '../entities/clinic.entity';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { ClinicAdminProfile } from '../entities/clinic-admin-profile.entity';
import { SecretaryProfile } from '../entities/secretary-profile.entity';
import { ExamCategory } from '../entities/exam-category.entity';
import { ExamCatalog } from '../entities/exam-catalog.entity';
import { ExamSchedule } from '../entities/exam-schedule.entity';
import { ExamScheduleItem } from '../entities/exam-schedule-item.entity';
import { DoctorDocument } from '../entities/doctor-document.entity';
import { FinancialSettings } from '../entities/financial-settings.entity';
import { FinancialCostCenter } from '../entities/financial-cost-center.entity';
import { FinancialConvenio } from '../entities/financial-convenio.entity';
import { FinancialRevenue } from '../entities/financial-revenue.entity';
import { FinancialExpense } from '../entities/financial-expense.entity';
import { FinancialDoctorTransfer } from '../entities/financial-doctor-transfer.entity';
import { FinancialCashflowEntry } from '../entities/financial-cashflow-entry.entity';
import { PatientAccessLog } from '../entities/patient-access-log.entity';
import { PatientDisease } from '../entities/patient-disease.entity';
import { PatientAllergy } from '../entities/patient-allergy.entity';
import { PatientVaccine } from '../entities/patient-vaccine.entity';
import { PatientSurgery } from '../entities/patient-surgery.entity';
import { ClinicDoctorInvite } from '../clinic-doctor-association/entities/clinic-doctor-invite.entity';
import { BackofficeUser } from '../entities/backoffice-user.entity';
import { MedicationCatalog } from '../entities/medication-catalog.entity';
import { SubscriptionPayment } from '../entities/subscription-payment.entity';
import { CnesEstablishment } from '../entities/cnes-establishment.entity';

/**
 * Railway exposes a ready-to-use connection string (MYSQL_URL / MYSQL_PUBLIC_URL).
 * Accepting it lets operators run migrations/seeds against an environment by
 * pasting a single variable instead of five.
 */
const connectionUrl =
  process.env.DATABASE_URL || process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL;

/**
 * When a connection URL is provided it must win: TypeORM gives precedence to
 * explicit host/port/username keys, so they are omitted entirely in that case.
 */
const connectionConfig = connectionUrl
  ? { url: connectionUrl }
  : {
      host: process.env.DB_HOST || process.env.MYSQL_HOST || process.env.MYSQLHOST || 'localhost',
      port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || process.env.MYSQLPORT || 3306),
      username:
        process.env.DB_USERNAME ||
        process.env.MYSQL_USER ||
        process.env.MYSQLUSER ||
        'pocketmed_user',
      password:
        process.env.DB_PASSWORD ||
        process.env.MYSQL_PASSWORD ||
        process.env.MYSQLPASSWORD ||
        'pocketmed_pass',
      database:
        process.env.DB_DATABASE ||
        process.env.MYSQL_DATABASE ||
        process.env.MYSQLDATABASE ||
        'pocketmed',
    };

const AppDataSource = new DataSource({
  type: 'mysql',
  ...connectionConfig,
  entities: [
    Patient,
    Doctor,
    Dependent,
    Appointment,
    Medication,
    Exam,
    DoctorAccessRequest,
    DoctorPermission,
    DependentResponsibleInvite,
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
    PatientDisease,
    PatientAllergy,
    PatientVaccine,
    PatientSurgery,
    ClinicDoctorInvite,
    BackofficeUser,
    MedicationCatalog,
    SubscriptionPayment,
    CnesEstablishment,
  ],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: false,
});

export default AppDataSource;
