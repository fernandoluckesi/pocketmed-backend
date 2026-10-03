import { Module } from '@nestjs/common';
import { SignatureService } from './signature.service';
import { SIGNATURE_PROVIDER } from './signature-provider.interface';
import { MockSignatureProvider } from './providers/mock-signature.provider';

/**
 * The only place that knows which `SignatureProvider` is active. Today it's
 * always `MockSignatureProvider` — switching to a real ICP-Brasil provider
 * later is changing the `useClass` line below, nothing else in the app.
 */
@Module({
  providers: [
    MockSignatureProvider,
    { provide: SIGNATURE_PROVIDER, useClass: MockSignatureProvider },
    SignatureService,
  ],
  exports: [SignatureService],
})
export class SignatureModule {}
