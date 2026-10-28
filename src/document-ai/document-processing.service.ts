import {
  Injectable,
  Inject,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  DOCUMENT_AI_PROVIDER,
  DocumentAiProvider,
} from './providers/document-ai-provider.interface';
import {
  MedicalDocument,
  MedicalDocumentSchema,
  ModelMedicalDocumentSchema,
  MEDICAL_DOCUMENT_SCHEMA_VERSION,
} from './contracts/medical-document.schema';

/**
 * Domain service for AI document extraction. Vendor-agnostic: it only talks to
 * the `DocumentAiProvider` port and returns Hispora's official JSON contract.
 *
 * Safety per the spec (archives/docs/ia-use/opea-ia.md):
 *  - Gated behind DOCUMENT_AI_ENABLED so identifiable documents stay blocked in
 *    production until the legal/governance checklist is complete.
 *  - Validates/normalizes the provider output against the Zod contract before
 *    returning it (structural validity is NOT proof of medical accuracy).
 *  - Never persists or logs the medical content of the response.
 */
@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);
  private readonly enabled: boolean;

  constructor(
    private configService: ConfigService,
    @Inject(DOCUMENT_AI_PROVIDER)
    private readonly provider: DocumentAiProvider,
  ) {
    // Fail-closed: the feature is OFF unless explicitly enabled. This is the
    // production gate required by the spec — do not flip to true until the
    // legal/governance checklist (Part II) is signed off.
    this.enabled =
      String(this.configService.get<string>('DOCUMENT_AI_ENABLED') ?? 'false')
        .trim()
        .toLowerCase() === 'true';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async extractFromDocument(input: {
    buffer: Buffer;
    mimeType: string;
    filename: string;
    userId: string;
  }): Promise<MedicalDocument> {
    if (!this.enabled) {
      throw new ForbiddenException(
        'O processamento de documentos por IA está desabilitado neste ambiente.',
      );
    }

    const operationId = randomUUID();

    // Audit the operation WITHOUT any medical content — only metadata.
    this.logger.log(
      `[doc-ai] start op=${operationId} user=${input.userId} mime=${input.mimeType} bytes=${input.buffer.length}`,
    );

    const raw = await this.provider.extract({
      buffer: input.buffer,
      mimeType: input.mimeType,
      filename: input.filename,
    });

    // Re-validate the provider output against the model contract. Structured
    // Outputs should already comply, but we never trust it blindly.
    const modelResult = ModelMedicalDocumentSchema.safeParse(raw);
    if (!modelResult.success) {
      this.logger.warn(
        `[doc-ai] invalid provider output op=${operationId}: ${modelResult.error.message}`,
      );
      throw new BadRequestException(
        'A resposta da IA não pôde ser validada. Tente novamente.',
      );
    }

    // Stamp the backend-owned metadata and validate the full public contract.
    const publicContract = MedicalDocumentSchema.parse({
      ...modelResult.data,
      schemaVersion: MEDICAL_DOCUMENT_SCHEMA_VERSION,
      operationId,
    });

    this.logger.log(
      `[doc-ai] done op=${operationId} type=${publicContract.documentType} status=${publicContract.status} ` +
        `exams=${publicContract.exams.length} meds=${publicContract.medications.length}`,
    );

    return publicContract;
  }
}
