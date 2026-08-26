import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DependentsController } from './dependents.controller';
import { DependentsService } from './dependents.service';
import { Dependent } from '../entities/dependent.entity';
import { Patient } from '../entities/patient.entity';
import { DependentResponsibleInvite } from '../entities/dependent-responsible-invite.entity';
import { UploadModule } from '../upload/upload.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dependent, Patient, DependentResponsibleInvite]),
    UploadModule,
    NotificationsModule,
  ],
  controllers: [DependentsController],
  providers: [DependentsService],
  exports: [DependentsService],
})
export class DependentsModule {}
