import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../entities/patient.entity';
import { Doctor } from '../entities/doctor.entity';
import { EmailModule } from '../email/email.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, Doctor]), EmailModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
