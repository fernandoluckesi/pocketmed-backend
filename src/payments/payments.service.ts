import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Clinic } from '../entities/clinic.entity';
import { planIdForStripePrice } from './stripe-price-map';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Clinic)
    private clinicRepository: Repository<Clinic>,
  ) {}

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
