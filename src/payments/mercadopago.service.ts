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
   * MP Webhooks v2 signature check (`x-signature` / `x-request-id` headers).
   * If no secret has been configured yet (the webhook subscription hasn't
   * been created in the MP dashboard), this passes through — the caller
   * still re-fetches authoritative state via `getSubscription` instead of
   * trusting the notification body, which is what MP recommends regardless.
   */
  verifyWebhookSignature(params: {
    xSignature?: string;
    xRequestId?: string;
    dataId?: string;
  }): boolean {
    const secret = this.configService.get<string>('MERCADOPAGO_WEBHOOK_SECRET');
    if (!secret) return true;
    if (!params.xSignature || !params.dataId) return false;

    const parts: Record<string, string> = {};
    for (const part of params.xSignature.split(',')) {
      const [key, value] = part.split('=');
      if (key && value) parts[key.trim()] = value.trim();
    }
    const ts = parts.ts;
    const v1 = parts.v1;
    if (!ts || !v1) return false;

    const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.xRequestId || ''};ts:${ts};`;
    const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    return expected === v1;
  }
}
