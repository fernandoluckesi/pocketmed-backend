/**
 * Status of a document's digital signature. No real signature provider is
 * wired up yet — only `MockSignatureProvider` exists, and it never produces
 * `SIGNED`. This is what structurally guarantees the app can't claim a
 * document is digitally signed before a real ICP-Brasil provider exists:
 * every place that would show "assinado" gates on this value, not on a
 * human remembering not to lie about it.
 */
export enum SignatureStatus {
  NONE = 'none',
  PENDING = 'pending',
  SIGNED = 'signed',
  FAILED = 'failed',
  REJECTED = 'rejected',
}

export interface SignDocumentInput {
  pdfBuffer: Buffer;
  documentHash: string;
  documentId: string;
  /** Doctor's display name, for a future provider's signing payload — never
   * a secret (no certificate/password/private key ever flows through here). */
  signerName: string;
}

export interface SignatureResult {
  status: SignatureStatus;
  provider: string;
  /** The document as it comes out of this step — unchanged for the mock
   * provider, the signed PAdES bytes for a future real provider. */
  pdfBuffer: Buffer;
  externalSignatureId: string | null;
  signedAt: Date | null;
}

export interface ProviderStatus {
  available: boolean;
  providerName: string;
}

/** The document types a `SignatureProvider` can be asked to sign — also the
 * literal prefix of each feature's own REST route (`/${documentType}s`), used
 * by the signature-simulator page to call the right feature back. */
export type SignableDocumentType = 'prescription' | 'report' | 'exam';

/** Starts an asynchronous signature request — the real-provider equivalent of
 * DocuSign's "create envelope" call. Carries the document type/id so the
 * provider can hand them back out via `getPendingSignatureInfo` without the
 * caller (`PrescriptionsService`, etc.) needing to track its own requests. */
export interface RequestSignatureInput {
  documentId: string;
  documentType: SignableDocumentType;
  documentHash: string;
  pdfBuffer: Buffer;
  signerName: string;
}

export interface SignatureRequestResult {
  status: SignatureStatus.PENDING;
  provider: string;
  externalSignatureId: string;
  /** Where the signer is sent to complete the signature — a real provider's
   * hosted signing page URL; the simulator's own frontend route for
   * `MockSignatureProvider`. */
  signingUrl: string;
}

/** What the signature-simulator page needs to render itself and to know
 * which feature endpoint to call back once "signed". */
export interface PendingSignatureInfo {
  documentId: string;
  documentType: SignableDocumentType;
  signerName: string;
}
