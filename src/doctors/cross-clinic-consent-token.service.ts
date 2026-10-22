import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';

/**
 * Token helper for the cross-clinic consent link (item: patient Shadow
 * authorization flow). Deliberately NOT a JWT like
 * `DocumentAccessTokenService` — that one is stateless (signature + exp is
 * the only check), which can't express true single-use. A legal consent
 * action needs the token's validity to live in the database row it points
 * at (status, expiry), so a second attempt to use it — even before
 * expiry — fails because the row is no longer PENDING, not because the
 * token's own signature/exp says so.
 *
 * Only the SHA-256 hash of the token is ever persisted
 * (`DoctorAccessRequest.consentTokenHash`) — the raw token exists only in
 * the emailed link and in memory for the length of one request.
 */
@Injectable()
export class CrossClinicConsentTokenService {
  generate(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
