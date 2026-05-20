import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorDocumentsController } from './doctor-documents.controller';
import { DoctorDocumentsService } from './doctor-documents.service';
import { DoctorDocument } from '../entities/doctor-document.entity';
import { Doctor } from '../entities/doctor.entity';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DoctorDocument, Doctor]),
    UploadModule,
  ],
  controllers: [DoctorDocumentsController],
  providers: [DoctorDocumentsService],
  exports: [DoctorDocumentsService],
})
export class DoctorDocumentsModule {}
