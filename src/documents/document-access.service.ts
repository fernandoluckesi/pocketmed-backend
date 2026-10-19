import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prescription } from '../entities/prescription.entity';
import { ExamRequest } from '../entities/exam-request.entity';
import { UploadService } from '../upload/upload.service';
import { DocumentAccessTokenService, DocumentAccessKind } from './document-access-token.service';
import { DOCUMENT_FOLDERS } from './document.types';

/** How long the presigned storage URL the client is redirected to stays
 * valid — short on purpose, since the long-lived part of this flow is the
 * document-access token itself, not this one-time redirect target. */
const REDIRECT_URL_EXPIRY_SECONDS = 120;

@Injectable()
export class DocumentAccessService {
  private readonly logger = new Logger(DocumentAccessService.name);

  constructor(
    @InjectRepository(Prescription) private readonly prescriptionRepo: Repository<Prescription>,
    @InjectRepository(ExamRequest) private readonly examRequestRepo: Repository<ExamRequest>,
    private readonly tokenService: DocumentAccessTokenService,
    private readonly uploadService: UploadService,
  ) {}

  issueToken(kind: DocumentAccessKind, recordId: string, expiresIn: string): string {
    return this.tokenService.sign(kind, recordId, expiresIn);
  }

  /** Resolves a document-access token into a short-lived, directly fetchable
   * URL, or null if the token is invalid/expired/doesn't match a real
   * document. Callers must treat null as "not found", never leak the
   * distinction between "bad token" and "document missing" to the caller. */
  async resolveToPresignedUrl(token: string): Promise<string | null> {
    const payload = this.tokenService.verify(token);
    if (!payload) return null;

    const storedUrl = await this.findStoredUrl(payload.kind, payload.recordId);
    if (!storedUrl) {
      this.logger.warn(`Valid token for ${payload.kind}/${payload.recordId} but no stored document`);
      return null;
    }

    return this.uploadService.getPresignedUrl(storedUrl, REDIRECT_URL_EXPIRY_SECONDS);
  }

  private async findStoredUrl(kind: DocumentAccessKind, recordId: string): Promise<string | null> {
    switch (kind) {
      case DOCUMENT_FOLDERS.prescriptions: {
        const record = await this.prescriptionRepo.findOne({ where: { id: recordId } });
        return record?.documentUrl ?? null;
      }
      case DOCUMENT_FOLDERS.examRequests: {
        const record = await this.examRequestRepo.findOne({ where: { id: recordId } });
        return record?.documentUrl ?? null;
      }
      default:
        return null;
    }
  }
}
