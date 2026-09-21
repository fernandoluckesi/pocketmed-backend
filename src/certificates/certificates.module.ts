import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { CertificateParserService } from './certificate-parser.service';
import { Certificate } from '../entities/certificate.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Dependent } from '../entities/dependent.entity';
import { Appointment } from '../entities/appointment.entity';
import { DoctorsModule } from '../doctors/doctors.module';
import { UploadModule } from '../upload/upload.module';
import { DocumentParsingModule } from '../document-parsing/document-parsing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Certificate, Doctor, Patient, Dependent, Appointment]),
    DoctorsModule,
    UploadModule,
    DocumentParsingModule,
  ],
  controllers: [CertificatesController],
  providers: [CertificatesService, CertificateParserService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
