import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DocumentAiController } from './document-ai.controller';
import { DocumentProcessingService } from './document-processing.service';
import { OpenAiDocumentProvider } from './providers/openai-document.provider';
import { DOCUMENT_AI_PROVIDER } from './providers/document-ai-provider.interface';

/**
 * Wires the vendor-agnostic document AI feature. The concrete provider
 * (OpenAI today) is bound to the DOCUMENT_AI_PROVIDER token, so swapping
 * vendors later is a one-line change here — the domain service and the public
 * contract stay untouched.
 */
@Module({
  imports: [ConfigModule],
  controllers: [DocumentAiController],
  providers: [
    DocumentProcessingService,
    OpenAiDocumentProvider,
    { provide: DOCUMENT_AI_PROVIDER, useExisting: OpenAiDocumentProvider },
  ],
  exports: [DocumentProcessingService],
})
export class DocumentAiModule {}
