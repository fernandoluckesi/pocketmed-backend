import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { Patient } from '../entities/patient.entity';
import { DoctorPermission } from '../entities/doctor-permission.entity';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { Appointment } from '../entities/appointment.entity';
import { Medication } from '../entities/medication.entity';
import { Exam } from '../entities/exam.entity';
import { PatientAccessLog } from '../entities/patient-access-log.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      DoctorPermission,
      ClinicMembership,
      Appointment,
      Medication,
      Exam,
      PatientAccessLog,
    ]),
    NotificationsModule,
  ],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
