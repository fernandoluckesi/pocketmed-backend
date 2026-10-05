import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SignatureService } from './signature/signature.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Backs `web/src/pages/SignatureSimulator.tsx` — our stand-in for a real
 * provider's (DocuSign) hosted signing page. Read-only: completing a
 * signature happens through each feature's own `POST /:type/:id/confirm-signature`
 * route, never here, so every feature stays in control of updating its own
 * document row (mirrors how a real webhook would land on the feature, not
 * on this generic lookup).
 */
@ApiTags('Signature Simulator')
@Controller('signature-simulator')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class SignatureSimulatorController {
  constructor(private signatureService: SignatureService) {}

  @Get(':externalSignatureId')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Look up what a pending (mock) signature request is for' })
  @ApiResponse({ status: 200, description: 'Document type/id and signer name' })
  @ApiResponse({ status: 404, description: 'Unknown or already-completed request' })
  async getInfo(@Param('externalSignatureId') externalSignatureId: string) {
    const info = await this.signatureService.getPendingSignatureInfo(externalSignatureId);
    if (!info) {
      throw new NotFoundException('Solicitação de assinatura não encontrada ou já concluída.');
    }
    return info;
  }
}
