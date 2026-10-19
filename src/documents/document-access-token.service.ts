import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DOCUMENT_FOLDERS } from './document.types';

export type DocumentAccessKind = (typeof DOCUMENT_FOLDERS)[keyof typeof DOCUMENT_FOLDERS];

export interface DocumentAccessTokenPayload {
  scope: 'document-access';
  kind: DocumentAccessKind;
  /** Id of the owning record (Prescription, ExamRequest, ...), not the raw storage key. */
  recordId: string;
}

/**
 * Issues and verifies single-purpose, expiring tokens that grant access to
 * exactly one stored document — the mechanism behind every document link
 * handed to someone without an authenticated session (e.g. a shadow
 * patient's end-of-consultation email). Signed with DOCUMENT_ACCESS_SECRET,
 * a secret dedicated to this purpose and never shared with login JWTs
 * (see documents.module.ts) — compromising one can never forge the other.
 */
@Injectable()
export class DocumentAccessTokenService {
  private readonly logger = new Logger(DocumentAccessTokenService.name);

  constructor(private readonly jwtService: JwtService) {}

  /** @param expiresIn jsonwebtoken duration string, e.g. "90d", "10m". */
  sign(kind: DocumentAccessKind, recordId: string, expiresIn: string): string {
    const payload: DocumentAccessTokenPayload = { scope: 'document-access', kind, recordId };
    return this.jwtService.sign(payload, { expiresIn });
  }

  /** Returns the payload if the token is valid and unexpired, otherwise null
   * — callers treat an invalid token as "not found", not as a 401/403, to
   * avoid confirming to a prober whether a given id/token shape is real. */
  verify(token: string): DocumentAccessTokenPayload | null {
    try {
      const payload = this.jwtService.verify<DocumentAccessTokenPayload>(token);
      if (payload.scope !== 'document-access') return null;
      return payload;
    } catch (error) {
      this.logger.debug(`Rejected document access token: ${error.message}`);
      return null;
    }
  }
}
