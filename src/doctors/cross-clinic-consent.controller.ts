import { Controller, Get, Post, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import { CrossClinicAccessService } from './cross-clinic-access.service';
import { Public } from '../auth/decorators/public.decorator';
import { RespondToConsentDto } from './dto/respond-to-consent.dto';
import { THROTTLE_AUTH, THROTTLE_EMAIL } from '../common/throttler.config';

/**
 * Public-facing endpoints for the cross-clinic record-sharing consent page.
 * Reachable without login — the patient confirming here may have no app
 * account at all (shadow patient). Both routes are brute-force targets
 * (a code-guessing-shaped token), so they're throttled like the other
 * public code-verification endpoints in auth.controller.ts.
 */
@ApiTags('Cross-Clinic Access Consent')
@Controller('access-consent')
export class CrossClinicConsentController {
  constructor(private readonly crossClinicAccessService: CrossClinicAccessService) {}

  @Public()
  @Get(':requestId')
  @UseGuards(ThrottlerGuard)
  @Throttle({ [THROTTLE_AUTH]: { ttl: 60_000, limit: 10 } })
  @SkipThrottle({ [THROTTLE_EMAIL]: true })
  @ApiOperation({
    summary:
      'Fetch the info needed to render the consent page — does NOT consume the token (opening the link is never authorization)',
  })
  @ApiResponse({ status: 200, description: 'Consent details' })
  @ApiResponse({ status: 404, description: 'Invalid or expired link' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getConsentDetails(@Param('requestId') requestId: string, @Query('token') token: string) {
    return this.crossClinicAccessService.getConsentDetails(requestId, token);
  }

  @Public()
  @Post(':requestId/respond')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ [THROTTLE_AUTH]: { ttl: 60_000, limit: 10 } })
  @SkipThrottle({ [THROTTLE_EMAIL]: true })
  @ApiOperation({ summary: 'Authorize or deny a cross-clinic access request' })
  @ApiResponse({ status: 200, description: 'Decision recorded' })
  @ApiResponse({ status: 400, description: 'Identity confirmation failed' })
  @ApiResponse({ status: 404, description: 'Invalid or expired link' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async respond(@Param('requestId') requestId: string, @Body() dto: RespondToConsentDto) {
    return this.crossClinicAccessService.respondToConsent(
      requestId,
      dto.token,
      dto.decision,
      dto.cpfLast4,
    );
  }
}
