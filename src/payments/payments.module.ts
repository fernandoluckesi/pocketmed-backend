import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Clinic } from '../entities/clinic.entity';
import { SubscriptionPayment } from '../entities/subscription-payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { MercadoPagoService } from './mercadopago.service';
import { PaymentsCronService } from './payments-cron.service';

@Module({
  imports: [TypeOrmModule.forFeature([Clinic, SubscriptionPayment]), ConfigModule],
  controllers: [PaymentsController],
  providers: [StripeService, MercadoPagoService, PaymentsService, PaymentsCronService],
  exports: [StripeService, MercadoPagoService, PaymentsService],
})
export class PaymentsModule {}
