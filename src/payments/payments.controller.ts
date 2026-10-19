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
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { StripeService } from './stripe.service';
import { MercadoPagoService } from './mercadopago.service';
import { PaymentsService } from './payments.service';
import { MercadoPagoWebhookDto } from './dto/mercadopago-webhook.dto';

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
    // Route-level pipe overriding the global one from main.ts, which runs
    // with `forbidNonWhitelisted: true`. A real MP delivery carries fields
    // this integration ignores (`id`, `live_mode`, `date_created`,
    // `user_id`, `api_version`, and whatever MP adds next), so forbidding
    // unknown properties here would 400 every genuine notification — and
    // since MP retries any non-2xx every 15 minutes until it succeeds, that
    // becomes an indefinite retry storm with subscription updates never
    // applying. `whitelist` still strips anything undeclared, so nothing
    // unvalidated reaches the handler; it's just dropped instead of fatal.
    // Safe because no field of this body is ever persisted — `data.id` is
    // only used to re-fetch authoritative state from the MP API.
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    body: MercadoPagoWebhookDto,
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
      // 401, not 400: this is an authentication failure, and it's what MP's
      // own reference implementation returns for a bad signature. Logged
      // because on a public endpoint a burst of these is the signal that
      // someone is probing — or that the secret is misconfigured.
      this.logger.warn(
        `Rejected Mercado Pago webhook for data.id ${dataId}: invalid or missing signature`,
      );
      throw new UnauthorizedException('Invalid Mercado Pago webhook signature');
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
