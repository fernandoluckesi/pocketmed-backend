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

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || process.env.MYSQL_HOST || process.env.MYSQLHOST || 'localhost',
  port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || process.env.MYSQLPORT || 3306),
  username: process.env.DB_USERNAME || process.env.MYSQL_USER || process.env.MYSQLUSER || 'pocketmed_user',
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || process.env.MYSQLPASSWORD || 'pocketmed_pass',
  database: process.env.DB_DATABASE || process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || 'pocketmed',
  entities: [
    Patient,
    Doctor,
    Dependent,
    Appointment,
    Medication,
    Exam,
    DoctorAccessRequest,
    DoctorPermission,
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
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: false,
});

export default AppDataSource;
