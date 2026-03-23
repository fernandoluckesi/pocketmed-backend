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

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME || process.env.MYSQL_USER || 'pocketmed_user',
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || 'pocketmed_pass',
  database: process.env.DB_DATABASE || process.env.MYSQL_DATABASE || 'pocketmed',
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
  ],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: false,
});

export default AppDataSource;
