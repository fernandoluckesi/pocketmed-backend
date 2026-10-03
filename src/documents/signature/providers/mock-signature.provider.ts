import { Injectable } from '@nestjs/common';
import { SignatureProvider } from '../signature-provider.interface';
import {
  ProviderStatus,
  SignDocumentInput,
  SignatureResult,
  SignatureStatus,
} from '../signature.types';

/**
 * Does NOT sign anything — no digital-signature provider is contracted yet.
 * Exists so the whole generate→sign→store→serve flow can be built and
 * tested end to end today. Always returns the original PDF unchanged and
 * `SignatureStatus.NONE`, never `SIGNED` — this is intentional, not a
 * placeholder to "fix later": it's what keeps the app from ever claiming a
 * document is digitally signed while this is the active provider.
 */
@Injectable()
export class MockSignatureProvider implements SignatureProvider {
  readonly providerName = 'mock';

  async getProviderStatus(): Promise<ProviderStatus> {
    return { available: true, providerName: this.providerName };
  }

  async signDocument(input: SignDocumentInput): Promise<SignatureResult> {
    return {
      status: SignatureStatus.NONE,
      provider: this.providerName,
      pdfBuffer: input.pdfBuffer,
      externalSignatureId: null,
      signedAt: null,
    };
  }

  async getSignatureStatus(): Promise<SignatureResult> {
    return {
      status: SignatureStatus.NONE,
      provider: this.providerName,
      pdfBuffer: Buffer.alloc(0),
      externalSignatureId: null,
      signedAt: null,
    };
  }
}
