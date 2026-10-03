import { Test, TestingModule } from '@nestjs/testing';
import { SignatureService } from './signature.service';
import { SIGNATURE_PROVIDER } from './signature-provider.interface';
import { MockSignatureProvider } from './providers/mock-signature.provider';
import { SignatureStatus } from './signature.types';

/**
 * The central guarantee of the current signature setup: no provider is
 * contracted yet, so nothing in the system may end up marked as digitally
 * signed. These tests pin that down at the only layer that could produce a
 * `SIGNED` status, rather than relying on each caller to behave.
 */
describe('SignatureService with MockSignatureProvider', () => {
  let service: SignatureService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockSignatureProvider,
        { provide: SIGNATURE_PROVIDER, useClass: MockSignatureProvider },
        SignatureService,
      ],
    }).compile();

    service = module.get<SignatureService>(SignatureService);
  });

  it('reports the mock provider as available', async () => {
    await expect(service.getProviderStatus()).resolves.toEqual({
      available: true,
      providerName: 'mock',
    });
  });

  it('returns the original PDF bytes unchanged — it does not sign anything', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.7 original bytes');

    const result = await service.signDocument({
      pdfBuffer,
      documentHash: 'a'.repeat(64),
      documentId: 'doc-1',
      signerName: 'Dra. Ana',
    });

    expect(result.pdfBuffer.equals(pdfBuffer)).toBe(true);
  });

  it('never reports a document as SIGNED', async () => {
    const result = await service.signDocument({
      pdfBuffer: Buffer.from('%PDF-1.7'),
      documentHash: 'b'.repeat(64),
      documentId: 'doc-2',
      signerName: 'Dra. Ana',
    });

    expect(result.status).toBe(SignatureStatus.NONE);
    expect(result.signedAt).toBeNull();
    expect(result.externalSignatureId).toBeNull();
  });

  it('reports no signature when queried by external id', async () => {
    const result = await service.getSignatureStatus('whatever-id');

    expect(result.status).toBe(SignatureStatus.NONE);
    expect(result.provider).toBe('mock');
    expect(result.signedAt).toBeNull();
  });
});
