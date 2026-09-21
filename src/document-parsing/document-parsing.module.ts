import { Module } from '@nestjs/common';
import { DocumentTextExtractorService } from './document-text-extractor.service';

@Module({
  providers: [DocumentTextExtractorService],
  exports: [DocumentTextExtractorService],
})
export class DocumentParsingModule {}
