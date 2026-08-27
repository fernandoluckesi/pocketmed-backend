import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicDoctorAssociationController } from './clinic-doctor-association.controller';
import { ClinicDoctorAssociationService } from './clinic-doctor-association.service';
import { InviteExpirationScheduler } from './invite-expiration.scheduler';
import { ClinicDoctorInvite } from './entities/clinic-doctor-invite.entity';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { Doctor } from '../entities/doctor.entity';
import { Clinic } from '../entities/clinic.entity';
import { DoctorPermission } from '../entities/doctor-permission.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClinicDoctorInvite,
      ClinicMembership,
      Doctor,
      Clinic,
      DoctorPermission,
    ]),
    NotificationsModule,
  ],
  controllers: [ClinicDoctorAssociationController],
  providers: [ClinicDoctorAssociationService, InviteExpirationScheduler],
  exports: [ClinicDoctorAssociationService],
})
export class ClinicDoctorAssociationModule {}
