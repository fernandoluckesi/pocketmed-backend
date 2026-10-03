import { ProviderStatus, SignDocumentInput, SignatureResult } from './signature.types';

/**
 * A pluggable digital-signature backend. `PrescriptionsService`/`ReportsService`
 * never depend on a concrete provider (e.g. a future `ICPBrSignatureProvider`)
 * — only on `SignatureService`, which holds one of these behind an injection
 * token (see `signature.module.ts`). Swapping providers later is a one-line
 * change there, nothing else in the app needs to change.
 */
export interface SignatureProvider {
  readonly providerName: string;
  getProviderStatus(): Promise<ProviderStatus>;
  signDocument(input: SignDocumentInput): Promise<SignatureResult>;
  getSignatureStatus(externalSignatureId: string): Promise<SignatureResult>;
}

export const SIGNATURE_PROVIDER = 'SIGNATURE_PROVIDER';
