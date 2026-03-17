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

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [
    Patient,
    Doctor,
    Dependent,
    Appointment,
    Medication,
    Exam,
    DoctorAccessRequest,
    DoctorPermission,
  ],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: false,
});

export default AppDataSource;
