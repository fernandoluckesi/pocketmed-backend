import {
  PendingSignatureInfo,
  ProviderStatus,
  RequestSignatureInput,
  SignatureRequestResult,
  SignatureResult,
  SignDocumentInput,
} from './signature.types';

/**
 * A pluggable digital-signature backend. `PrescriptionsService`/`ReportsService`
 * never depend on a concrete provider (e.g. a future `DocuSignProvider`)
 * — only on `SignatureService`, which holds one of these behind an injection
 * token (see `signature.module.ts`). Swapping providers later is a one-line
 * change there, nothing else in the app needs to change.
 */
export interface SignatureProvider {
  readonly providerName: string;
  getProviderStatus(): Promise<ProviderStatus>;
  signDocument(input: SignDocumentInput): Promise<SignatureResult>;
  getSignatureStatus(externalSignatureId: string): Promise<SignatureResult>;

  /** Starts an async signing flow — a real provider creates a remote
   * envelope and returns its hosted signing URL; `MockSignatureProvider`
   * returns a URL to this app's own signature-simulator page. */
  requestSignature(input: RequestSignatureInput): Promise<SignatureRequestResult>;

  /** Called once the signer finishes — a real provider via its webhook
   * (through a thin controller endpoint), the mock via the simulator page
   * calling back directly. Finalizes the request and returns the signed
   * result; the caller still owns updating its own document row. */
  completeSignature(externalSignatureId: string): Promise<SignatureResult>;

  /** Lets the signature-simulator page (or a real provider's own hosted
   * page) look up what it's signing and who for. Null if the request is
   * unknown or already completed. */
  getPendingSignatureInfo(externalSignatureId: string): Promise<PendingSignatureInfo | null>;
}

export const SIGNATURE_PROVIDER = 'SIGNATURE_PROVIDER';
