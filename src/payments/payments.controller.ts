import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { StripeService } from './stripe.service';
import { MercadoPagoService } from './mercadopago.service';
import { PaymentsService } from './payments.service';

@Controller('webhooks')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Public()
  @Post('stripe')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody || !signature) {
      throw new BadRequestException('Missing Stripe signature or raw body');
    }

    let event;
    try {
      event = this.stripeService.constructWebhookEvent(req.rawBody, signature);
    } catch (err) {
      throw new BadRequestException(`Invalid Stripe webhook signature: ${err.message}`);
    }

    await this.paymentsService.handleWebhookEvent(event);

    return { received: true };
  }

  @Public()
  @Post('mercadopago')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleMercadoPagoWebhook(
    @Body() body: { type?: string; topic?: string; action?: string; data?: { id?: string } },
    @Headers('x-signature') xSignature?: string,
    @Headers('x-request-id') xRequestId?: string,
  ) {
    const dataId = body?.data?.id;
    if (!dataId) return { received: true };

    const validSignature = this.mercadoPagoService.verifyWebhookSignature({
      xSignature,
      xRequestId,
      dataId,
    });
    if (!validSignature) {
      throw new BadRequestException('Invalid Mercado Pago webhook signature');
    }

    // Mercado Pago identifies the event in `type` or (older deliveries) in
    // `topic`, and the value varies by how the webhook was configured in the
    // dashboard: the same subscription event arrives as `preapproval` or as
    // `subscription_preapproval`. Normalized here so a dashboard-side naming
    // difference doesn't silently drop the notification.
    const event = (body.type || body.topic || '').toLowerCase();

    // `subscription_authorized_payment` carries an authorized-payment id,
    // which is neither a preapproval id nor a payment id — looking it up in
    // either service would just miss. The daily reconciliation cron picks
    // these charges up via external_reference instead.
    if (event.includes('authorized_payment')) {
      this.logger.log(
        `Mercado Pago authorized-payment notification ${dataId} acknowledged; ` +
          `reconciliation is handled by the daily sweep`,
      );
    } else if (event.includes('preapproval') || event.includes('subscription')) {
      await this.paymentsService.syncMercadoPagoSubscription(dataId);
    } else if (event.includes('payment')) {
      await this.paymentsService.upsertMercadoPagoPayment(dataId);
    } else {
      // Not an error: the dashboard may be subscribed to topics this
      // integration doesn't handle. Logged so it stops being invisible.
      this.logger.warn(
        `Unhandled Mercado Pago webhook event "${event || '(empty)'}" for data.id ${dataId}`,
      );
    }

    return { received: true };
  }
}
