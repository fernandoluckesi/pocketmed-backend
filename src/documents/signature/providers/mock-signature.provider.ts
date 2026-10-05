import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SignatureProvider } from '../signature-provider.interface';
import {
  PendingSignatureInfo,
  ProviderStatus,
  RequestSignatureInput,
  SignatureRequestResult,
  SignatureResult,
  SignDocumentInput,
  SignatureStatus,
} from '../signature.types';

interface PendingRequest extends PendingSignatureInfo {
  pdfBuffer: Buffer;
  createdAt: Date;
}

/**
 * Does NOT really sign anything — no digital-signature provider is
 * contracted yet (DocuSign is planned). Exists so the whole generate→sign→
 * store→serve flow, including the async "go sign elsewhere, come back
 * signed" shape a real provider has, can be built and exercised end to end
 * today via `web/src/pages/SignatureSimulator.tsx` (our own stand-in for
 * DocuSign's hosted signing page). `signDocument`/`getSignatureStatus`
 * never produce `SIGNED` — only `completeSignature`, called after the
 * simulator page confirms, does — so nothing can claim a document is
 * digitally signed without that explicit step.
 *
 * Pending requests live in memory only (`Map`, not a DB table): this is a
 * simulation aid, not real signature-request state a real provider would
 * hold on its own servers. It does not survive a backend restart — the
 * simulator page just shows "unknown/expired" in that case, which is a
 * reasonable analogue for a real provider's session mechanics anyway.
 */
@Injectable()
export class MockSignatureProvider implements SignatureProvider {
  readonly providerName = 'mock';

  private readonly pending = new Map<string, PendingRequest>();

  constructor(private readonly configService: ConfigService) {}

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

  async requestSignature(input: RequestSignatureInput): Promise<SignatureRequestResult> {
    const externalSignatureId = randomUUID();
    this.pending.set(externalSignatureId, {
      documentId: input.documentId,
      documentType: input.documentType,
      signerName: input.signerName,
      pdfBuffer: input.pdfBuffer,
      createdAt: new Date(),
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    return {
      status: SignatureStatus.PENDING,
      provider: this.providerName,
      externalSignatureId,
      signingUrl: `${frontendUrl}/assinatura-simulada/${externalSignatureId}`,
    };
  }

  async completeSignature(externalSignatureId: string): Promise<SignatureResult> {
    const entry = this.pending.get(externalSignatureId);
    if (!entry) {
      return {
        status: SignatureStatus.FAILED,
        provider: this.providerName,
        pdfBuffer: Buffer.alloc(0),
        externalSignatureId,
        signedAt: null,
      };
    }

    this.pending.delete(externalSignatureId);

    return {
      status: SignatureStatus.SIGNED,
      provider: this.providerName,
      pdfBuffer: entry.pdfBuffer,
      externalSignatureId,
      signedAt: new Date(),
    };
  }

  async getPendingSignatureInfo(externalSignatureId: string): Promise<PendingSignatureInfo | null> {
    const entry = this.pending.get(externalSignatureId);
    if (!entry) return null;
    return {
      documentId: entry.documentId,
      documentType: entry.documentType,
      signerName: entry.signerName,
    };
  }
}
