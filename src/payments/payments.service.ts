import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Clinic } from '../entities/clinic.entity';
import { SubscriptionPayment } from '../entities/subscription-payment.entity';
import { planIdForStripePrice } from './stripe-price-map';
import { MercadoPagoService } from './mercadopago.service';
import { parseExternalReference } from './mercadopago-reference';
import { getPlan } from '../plans/plans.config';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Clinic)
    private clinicRepository: Repository<Clinic>,
    @InjectRepository(SubscriptionPayment)
    private subscriptionPaymentRepository: Repository<SubscriptionPayment>,
    private mercadoPagoService: MercadoPagoService,
  ) {}

  /** Upserts Hispora's own record of a single Mercado Pago charge — called
   * by the webhook (one payment at a time, near-real-time) and by the daily
   * reconciliation cron (one call per payment found in a search sweep, to
   * catch anything a missed webhook didn't report). Idempotent: re-running
   * it for the same payment id just refreshes the status/amounts. */
  async upsertMercadoPagoPayment(paymentId: string): Promise<void> {
    const payment = await this.mercadoPagoService.getPayment(paymentId);
    if (!payment.id) return;

    const clinic = await this.resolveClinicForPayment(payment);
    if (!clinic) {
      this.logger.warn(`No clinic found for Mercado Pago payment ${paymentId}`);
      return;
    }

    const feeAmount = (payment.fee_details || []).reduce((sum, fee) => sum + (fee.amount || 0), 0);
    const subscriptionId =
      payment.point_of_interaction?.transaction_data?.subscription_id ||
      clinic.mercadoPagoPreapprovalId ||
      null;

    let record = await this.subscriptionPaymentRepository.findOne({
      where: { provider: 'mercadopago', externalPaymentId: String(payment.id) },
    });
    if (!record) {
      record = this.subscriptionPaymentRepository.create({
        clinicId: clinic.id,
        provider: 'mercadopago',
        externalPaymentId: String(payment.id),
      });
    }

    record.preapprovalId = subscriptionId;
    record.status = payment.status || 'unknown';
    record.statusDetail = payment.status_detail || null;
    record.transactionAmount = payment.transaction_amount || 0;
    record.netReceivedAmount = payment.transaction_details?.net_received_amount ?? null;
    record.feeAmount = feeAmount || null;
    record.currencyId = payment.currency_id || null;
    record.paymentMethodId = payment.payment_method_id || null;
    record.paymentTypeId = payment.payment_type_id || null;
    record.description = payment.description || null;
    record.dateCreated = payment.date_created ? new Date(payment.date_created) : null;
    record.dateApproved = payment.date_approved ? new Date(payment.date_approved) : null;
    record.moneyReleaseDate = payment.money_release_date
      ? new Date(payment.money_release_date)
      : null;
    record.moneyReleaseStatus = payment.money_release_status || null;

    await this.subscriptionPaymentRepository.save(record);
  }

  /** A recurring charge's `external_reference` mirrors the preapproval that
   * generated it, and `point_of_interaction.transaction_data.subscription_id`
   * is the preapproval id directly when present — either resolves the clinic. */
  private async resolveClinicForPayment(payment: {
    external_reference?: string;
    point_of_interaction?: { transaction_data?: { subscription_id?: string } };
  }): Promise<Clinic | null> {
    const subscriptionId = payment.point_of_interaction?.transaction_data?.subscription_id;
    if (subscriptionId) {
      const byPreapproval = await this.clinicRepository.findOne({
        where: { mercadoPagoPreapprovalId: subscriptionId },
      });
      if (byPreapproval) return byPreapproval;
    }

    const parsed = parseExternalReference(payment.external_reference);
    if (parsed) {
      return this.clinicRepository.findOne({ where: { id: parsed.clinicId } });
    }

    return null;
  }

  /** Re-fetches a Mercado Pago subscription's authoritative state (used by
   * both the webhook handler and the frontend's post-checkout return path,
   * since a redirect back doesn't guarantee the webhook has arrived yet —
   * especially in local development, where MP can't reach localhost at all). */
  async syncMercadoPagoSubscription(preapprovalId: string): Promise<Clinic | null> {
    const clinic = await this.clinicRepository.findOne({
      where: { mercadoPagoPreapprovalId: preapprovalId },
    });
    if (!clinic) {
      this.logger.warn(`No clinic found for Mercado Pago subscription ${preapprovalId}`);
      return null;
    }

    const subscription = await this.mercadoPagoService.getSubscription(preapprovalId);
    if (subscription.status) clinic.subscriptionStatus = subscription.status;
    if (subscription.next_payment_date) {
      clinic.currentPeriodEnd = new Date(subscription.next_payment_date);
    }

    // Only apply the pending plan change once MP confirms the recurring
    // charge was actually authorized — a merely "pending" preapproval hasn't
    // been paid for yet and shouldn't unlock the plan's features.
    if (subscription.status === 'authorized') {
      const parsed = parseExternalReference(subscription.external_reference);
      if (parsed) {
        clinic.planId = getPlan(parsed.planId).id;
        clinic.additionalProfessionals = parsed.additionalProfessionals;
      }
    }

    return this.clinicRepository.save(clinic);
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await this.onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Other event types aren't relevant to subscription state yet.
        break;
    }
  }

  private async onCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const clinicId = session.metadata?.clinicId;
    const planId = session.metadata?.planId;
    if (!clinicId || session.mode !== 'subscription') return;

    const clinic = await this.clinicRepository.findOne({ where: { id: clinicId } });
    if (!clinic) {
      this.logger.warn(`checkout.session.completed for unknown clinic ${clinicId}`);
      return;
    }

    if (planId) clinic.planId = planId;
    clinic.stripeCustomerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
    clinic.stripeSubscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id || null;
    clinic.subscriptionStatus = 'active';
    await this.clinicRepository.save(clinic);
  }

  private async onSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const clinic = await this.findClinicBySubscription(subscription);
    if (!clinic) return;

    clinic.subscriptionStatus = subscription.status;

    const currentPeriodEnd = (subscription as any).current_period_end as number | undefined;
    if (currentPeriodEnd) {
      clinic.currentPeriodEnd = new Date(currentPeriodEnd * 1000);
    }

    // If the plan or add-on quantity was changed directly from the Stripe
    // billing portal, reflect it back into our own records.
    const basePriceId = subscription.items.data[0]?.price?.id;
    if (basePriceId) {
      const planId = planIdForStripePrice(basePriceId);
      if (planId) clinic.planId = planId;
    }
    const addonItem = subscription.items.data.find((item) => item.price?.id !== basePriceId);
    if (addonItem) {
      clinic.additionalProfessionals = addonItem.quantity || 0;
    }

    await this.clinicRepository.save(clinic);
  }

  private async onSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const clinic = await this.findClinicBySubscription(subscription);
    if (!clinic) return;

    // Access-gating by plan isn't enforced yet, so we only record the
    // cancellation here — an admin decides manually what happens next.
    clinic.subscriptionStatus = 'canceled';
    await this.clinicRepository.save(clinic);
  }

  private async onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = (invoice as any).subscription as string | undefined;
    if (!subscriptionId) return;

    const clinic = await this.clinicRepository.findOne({
      where: { stripeSubscriptionId: subscriptionId },
    });
    if (!clinic) return;

    clinic.subscriptionStatus = 'past_due';
    await this.clinicRepository.save(clinic);
  }

  private async findClinicBySubscription(
    subscription: Stripe.Subscription,
  ): Promise<Clinic | null> {
    const clinic = await this.clinicRepository.findOne({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!clinic) {
      this.logger.warn(`No clinic found for Stripe subscription ${subscription.id}`);
      return null;
    }
    return clinic;
  }
}
