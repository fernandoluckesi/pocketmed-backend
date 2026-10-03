import { Module } from '@nestjs/common';
import { DocumentGenerationService } from './document-generation.service';
import { SignatureModule } from './signature/signature.module';
import { UploadModule } from '../upload/upload.module';

/** Shared document-generation + signature infrastructure, imported by
 * PrescriptionsModule, ReportsModule, and future document-producing modules. */
@Module({
  imports: [UploadModule, SignatureModule],
  providers: [DocumentGenerationService],
  exports: [DocumentGenerationService, SignatureModule],
})
export class DocumentsModule {}
