import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Clinic } from '../entities/clinic.entity';
import { MercadoPagoService } from './mercadopago.service';
import { PaymentsService } from './payments.service';

/**
 * Safety net for the webhook-driven flow: a payment notification can be
 * delayed, dropped, or simply never delivered if the webhook wasn't
 * configured yet in the MP dashboard (or MERCADOPAGO_WEBHOOK_SECRET is
 * blank locally). This sweeps every clinic with an active Mercado Pago
 * subscription once a day and re-syncs anything the webhook missed —
 * primary updates still happen in near-real-time via the webhook; this
 * only catches the gaps.
 */
@Injectable()
export class PaymentsCronService {
  private readonly logger = new Logger(PaymentsCronService.name);

  constructor(
    @InjectRepository(Clinic)
    private clinicRepository: Repository<Clinic>,
    private mercadoPagoService: MercadoPagoService,
    private paymentsService: PaymentsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'mercadopago-payments-reconciliation' })
  async handleReconciliation() {
    if (!this.mercadoPagoService.isConfigured()) return;

    const clinics = await this.clinicRepository.find();
    const withSubscription = clinics.filter((c) => c.mercadoPagoExternalReference);

    this.logger.log(
      `Reconciling Mercado Pago payments for ${withSubscription.length} clinic(s) with an active subscription...`,
    );

    let synced = 0;
    for (const clinic of withSubscription) {
      try {
        const payments = await this.mercadoPagoService.searchPaymentsByExternalReference(
          clinic.mercadoPagoExternalReference as string,
        );
        for (const payment of payments) {
          if (!payment.id) continue;
          await this.paymentsService.upsertMercadoPagoPayment(String(payment.id));
          synced++;
        }
      } catch (error) {
        this.logger.error(`Failed to reconcile payments for clinic ${clinic.id}`, error);
      }
    }

    this.logger.log(`Reconciliation complete: ${synced} payment(s) synced.`);
  }
}
