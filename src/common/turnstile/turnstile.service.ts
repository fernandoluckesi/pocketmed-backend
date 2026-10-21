import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileSiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

/**
 * Verifies a Cloudflare Turnstile token against the siteverify API — the
 * CAPTCHA gate on public registration forms (audit item #12).
 *
 * Opt-in: without `TURNSTILE_SECRET_KEY` configured, verification is skipped
 * entirely (logged once), so local/test environments and the existing
 * registration e2e tests (which don't send a token) keep working unchanged —
 * same pattern as `DB_SSL`.
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly secretKey?: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.secretKey = this.configService.get<string>('TURNSTILE_SECRET_KEY');
    if (!this.secretKey) {
      this.logger.warn(
        'TURNSTILE_SECRET_KEY not set — captcha verification is disabled (dev/test default).',
      );
    }
  }

  async verify(token: string | undefined, remoteIp?: string): Promise<void> {
    if (!this.secretKey) return;

    if (!token) {
      throw new BadRequestException('Verificação de segurança (captcha) ausente.');
    }

    try {
      const params = new URLSearchParams({ secret: this.secretKey, response: token });
      if (remoteIp) params.append('remoteip', remoteIp);

      const { data } = await firstValueFrom(
        this.httpService.post<TurnstileSiteverifyResponse>(SITEVERIFY_URL, params),
      );

      if (!data?.success) {
        this.logger.warn(`Turnstile verification failed: ${JSON.stringify(data?.['error-codes'])}`);
        throw new BadRequestException('Verificação de segurança (captcha) inválida.');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      // The Cloudflare API itself is unreachable/erroring — fail open rather
      // than taking down every registration over a third-party outage.
      this.logger.error(`Turnstile siteverify call failed, allowing registration through: ${err}`);
    }
  }
}
