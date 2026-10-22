import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorsController } from './doctors.controller';
import { DoctorsService } from './doctors.service';
import { CrossClinicAccessService } from './cross-clinic-access.service';
import { CrossClinicConsentTokenService } from './cross-clinic-consent-token.service';
import { CrossClinicConsentController } from './cross-clinic-consent.controller';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Dependent } from '../entities/dependent.entity';
import { Clinic } from '../entities/clinic.entity';
import { DoctorAccessRequest } from '../entities/doctor-access-request.entity';
import { DoctorPermission } from '../entities/doctor-permission.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Doctor,
      Patient,
      Dependent,
      Clinic,
      DoctorAccessRequest,
      DoctorPermission,
    ]),
    NotificationsModule,
    EmailModule,
  ],
  controllers: [DoctorsController, CrossClinicConsentController],
  providers: [DoctorsService, CrossClinicAccessService, CrossClinicConsentTokenService],
  exports: [DoctorsService, CrossClinicAccessService],
})
export class DoctorsModule {}
