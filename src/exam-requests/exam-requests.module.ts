import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamRequestsController } from './exam-requests.controller';
import { ExamRequestsService } from './exam-requests.service';
import { ExamRequest } from '../entities/exam-request.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Dependent } from '../entities/dependent.entity';
import { Appointment } from '../entities/appointment.entity';
import { DoctorsModule } from '../doctors/doctors.module';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExamRequest, Doctor, Patient, Dependent, Appointment]),
    DoctorsModule,
    DocumentsModule,
    NotificationsModule,
  ],
  controllers: [ExamRequestsController],
  providers: [ExamRequestsService],
  exports: [ExamRequestsService],
})
export class ExamRequestsModule {}
