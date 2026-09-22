import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { getAddonPriceEnvVar, getPlanPriceEnvVar } from './stripe-price-map';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe | null;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = secretKey ? new Stripe(secretKey) : null;
    if (!this.stripe) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set — payment gateway endpoints will respond as unavailable.',
      );
    }
  }

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  /** Price id for a plan's base monthly fee, if one was configured. */
  getPriceId(planId: string): string | null {
    const envVar = getPlanPriceEnvVar(planId);
    return envVar ? this.configService.get<string>(envVar) || null : null;
  }

  /** Price id for the plan's per-extra-professional add-on, if one was configured. */
  getAddonPriceId(planId: string): string | null {
    const envVar = getAddonPriceEnvVar(planId);
    return envVar ? this.configService.get<string>(envVar) || null : null;
  }

  private get client(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)');
    }
    return this.stripe;
  }

  async createCustomer(params: { email: string; name: string; clinicId: string }): Promise<string> {
    const customer = await this.client.customers.create({
      email: params.email,
      name: params.name,
      metadata: { clinicId: params.clinicId },
    });
    return customer.id;
  }

  async createCheckoutSession(params: {
    customerId: string;
    clinicId: string;
    planId: string;
    priceId: string;
    addonPriceId?: string | null;
    addonQuantity?: number;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }> {
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: params.priceId, quantity: 1 },
    ];
    if (params.addonPriceId && params.addonQuantity && params.addonQuantity > 0) {
      lineItems.push({ price: params.addonPriceId, quantity: params.addonQuantity });
    }

    const session = await this.client.checkout.sessions.create({
      mode: 'subscription',
      customer: params.customerId,
      line_items: lineItems,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { clinicId: params.clinicId, planId: params.planId },
      subscription_data: {
        metadata: { clinicId: params.clinicId, planId: params.planId },
      },
    });

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL');
    }
    return { url: session.url };
  }

  async createBillingPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    const session = await this.client.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });
    return { url: session.url };
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }
    return this.client.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
