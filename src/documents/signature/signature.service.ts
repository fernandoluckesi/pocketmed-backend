import { Inject, Injectable } from '@nestjs/common';
import { SIGNATURE_PROVIDER, SignatureProvider } from './signature-provider.interface';
import {
  PendingSignatureInfo,
  ProviderStatus,
  RequestSignatureInput,
  SignatureRequestResult,
  SignatureResult,
  SignDocumentInput,
} from './signature.types';

/**
 * Facade in front of whichever `SignatureProvider` is bound in
 * `signature.module.ts` (only `MockSignatureProvider` today). Every caller
 * — `PrescriptionsService`, `ReportsService`, anything added later —
 * depends on this, never on a concrete provider class.
 */
@Injectable()
export class SignatureService {
  constructor(@Inject(SIGNATURE_PROVIDER) private readonly provider: SignatureProvider) {}

  getProviderStatus(): Promise<ProviderStatus> {
    return this.provider.getProviderStatus();
  }

  signDocument(input: SignDocumentInput): Promise<SignatureResult> {
    return this.provider.signDocument(input);
  }

  getSignatureStatus(externalSignatureId: string): Promise<SignatureResult> {
    return this.provider.getSignatureStatus(externalSignatureId);
  }

  requestSignature(input: RequestSignatureInput): Promise<SignatureRequestResult> {
    return this.provider.requestSignature(input);
  }

  completeSignature(externalSignatureId: string): Promise<SignatureResult> {
    return this.provider.completeSignature(externalSignatureId);
  }

  getPendingSignatureInfo(externalSignatureId: string): Promise<PendingSignatureInfo | null> {
    return this.provider.getPendingSignatureInfo(externalSignatureId);
  }
}
