import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { StripeService } from './stripe.service';
import { PaymentsService } from './payments.service';

@Controller('webhooks')
export class PaymentsController {
  constructor(
    private readonly stripeService: StripeService,
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
}
