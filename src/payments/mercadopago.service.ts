import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago';

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly config: MercadoPagoConfig | null;

  constructor(private readonly configService: ConfigService) {
    const accessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    this.config = accessToken ? new MercadoPagoConfig({ accessToken }) : null;
    if (!this.config) {
      this.logger.warn(
        'MERCADOPAGO_ACCESS_TOKEN not set — payment gateway endpoints will respond as unavailable.',
      );
    }
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  private get preApproval(): PreApproval {
    if (!this.config) {
      throw new Error('Mercado Pago is not configured (MERCADOPAGO_ACCESS_TOKEN missing)');
    }
    return new PreApproval(this.config);
  }

  private get payment(): Payment {
    if (!this.config) {
      throw new Error('Mercado Pago is not configured (MERCADOPAGO_ACCESS_TOKEN missing)');
    }
    return new Payment(this.config);
  }

  /** Creates a recurring subscription ("assinatura"). Returns the URL the
   * clinic admin must be redirected to in order to authorize the charge. */
  async createSubscription(params: {
    reason: string;
    amount: number;
    payerEmail: string;
    externalReference: string;
    backUrl: string;
  }): Promise<{ id: string; initPoint: string }> {
    const result = await this.preApproval.create({
      body: {
        reason: params.reason,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: params.amount,
          currency_id: 'BRL',
        },
        back_url: params.backUrl,
        payer_email: params.payerEmail,
        external_reference: params.externalReference,
      },
    });

    // Test/sandbox credentials return `sandbox_init_point` alongside (or
    // instead of) `init_point` — not in the SDK's response type, but present
    // on the actual JSON, so it's read defensively.
    const initPoint =
      (result as { sandbox_init_point?: string }).sandbox_init_point || result.init_point;

    if (!result.id || !initPoint) {
      throw new Error('Mercado Pago did not return a subscription checkout URL');
    }
    return { id: result.id, initPoint };
  }

  async getSubscription(preapprovalId: string) {
    return this.preApproval.get({ id: preapprovalId });
  }

  async cancelSubscription(preapprovalId: string) {
    return this.preApproval.update({ id: preapprovalId, body: { status: 'cancelled' } });
  }

  /** Full details of a single charge — used both by the webhook handler
   * (one payment at a time) and to enrich search results below. */
  async getPayment(paymentId: string) {
    return this.payment.get({ id: paymentId });
  }

  /** Finds every charge tied to a subscription's `external_reference` — the
   * reconciliation cron's way of catching anything a missed/delayed webhook
   * didn't report (Mercado Pago has no "list payments by preapproval id"
   * filter; external_reference is the documented way to correlate them). */
  async searchPaymentsByExternalReference(externalReference: string) {
    const result = await this.payment.search({
      options: { external_reference: externalReference, sort: 'date_created', criteria: 'desc' },
    });
    return result.results || [];
  }

  /**
   * How old an `x-signature` timestamp may be before the notification is
   * treated as a replay. MP retries a failed delivery every 15 minutes, so
   * the window has to comfortably exceed a single delivery attempt's own
   * latency without being wide enough to make captured requests useful.
   * Five minutes is the common choice across webhook providers.
   */
  private static readonly SIGNATURE_MAX_AGE_SECONDS = 300;

  /**
   * MP Webhooks v2 signature check (`x-signature` / `x-request-id` headers).
   *
   * Returns true only for a notification that is provably from Mercado Pago
   * and recent. Three properties this deliberately guarantees, each of which
   * was missing before:
   *
   *  1. **Fails closed when unconfigured.** This used to `return true` if
   *     MERCADOPAGO_WEBHOOK_SECRET was unset, which meant a deployment that
   *     simply forgot the variable accepted forged notifications from anyone
   *     — and the endpoint is public. Since the handler can flip a clinic's
   *     subscriptionStatus and planId, that let an attacker who guessed a
   *     preapproval id drive paid-plan state. Re-fetching state from the MP
   *     API limits the damage (a forged body is never persisted) but does
   *     not prevent it: `syncMercadoPagoSubscription` applies whatever MP
   *     reports for the id it was handed, so forcing a sync at a chosen
   *     moment is still an unauthenticated write. It now returns false, and
   *     the caller decides how to respond (see payments.controller.ts).
   *
   *  2. **Constant-time comparison.** `expected === v1` on a secret-derived
   *     HMAC leaks, through timing, how many leading bytes matched. With an
   *     endpoint an attacker can call freely and a signature they control,
   *     that is the textbook setup for recovering a valid signature byte by
   *     byte. `crypto.timingSafeEqual` removes the signal.
   *
   *  3. **Replay rejection.** A signature stays valid forever if only the
   *     HMAC is checked, so a single captured delivery could be re-sent
   *     indefinitely. `ts` is part of the signed manifest — an attacker
   *     can't retime a captured request without invalidating the signature —
   *     so bounding its age closes replays.
   */
  verifyWebhookSignature(params: {
    xSignature?: string;
    xRequestId?: string;
    dataId?: string;
  }): boolean {
    const secret = this.configService.get<string>('MERCADOPAGO_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.error(
        'MERCADOPAGO_WEBHOOK_SECRET is not set — rejecting the webhook notification. ' +
          'Configure the secret from Suas integrações > Webhooks in the Mercado Pago dashboard.',
      );
      return false;
    }
    if (!params.xSignature || !params.dataId) return false;

    const parts: Record<string, string> = {};
    for (const part of params.xSignature.split(',')) {
      const [key, value] = part.split('=');
      if (key && value) parts[key.trim()] = value.trim();
    }
    const ts = parts.ts;
    const v1 = parts.v1;
    if (!ts || !v1) return false;

    // Reject stale/replayed deliveries. `ts` is a Unix timestamp in seconds
    // and is covered by the HMAC below, so it can't be rewritten in transit.
    const tsSeconds = Number(ts);
    if (!Number.isFinite(tsSeconds)) return false;
    const ageSeconds = Math.abs(Date.now() / 1000 - tsSeconds);
    if (ageSeconds > MercadoPagoService.SIGNATURE_MAX_AGE_SECONDS) {
      this.logger.warn(
        `Rejected Mercado Pago webhook with stale signature timestamp (age ${Math.round(ageSeconds)}s).`,
      );
      return false;
    }

    const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.xRequestId || ''};ts:${ts};`;
    const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

    // timingSafeEqual throws on length mismatch, so compare lengths first —
    // the length of a hex SHA-256 digest isn't secret.
    const expectedBuf = Buffer.from(expected, 'utf8');
    const receivedBuf = Buffer.from(v1, 'utf8');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  }
}
