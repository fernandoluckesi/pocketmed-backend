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
