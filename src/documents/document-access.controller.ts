import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { DocumentAccessService } from './document-access.service';

/**
 * The only route in the backend that serves a medical document without an
 * authenticated session — reachable solely via a scoped, expiring token
 * (see DocumentAccessTokenService), never via a raw storage URL. Used by
 * prescription/exam-request links sent by email, where the recipient (a
 * shadow patient, or a pharmacy/lab the patient forwards the link to) has
 * no Hispora login at all.
 */
@Controller('documents/access')
export class DocumentAccessController {
  constructor(private readonly documentAccessService: DocumentAccessService) {}

  @Public()
  @Get(':token')
  async access(@Param('token') token: string, @Res() res: Response) {
    const url = await this.documentAccessService.resolveToPresignedUrl(token);
    if (!url) {
      // Same response for "bad token", "expired token" and "document gone" -
      // never confirm to an unauthenticated caller which one it was.
      throw new NotFoundException('Link inválido ou expirado.');
    }
    res.redirect(302, url);
  }
}
