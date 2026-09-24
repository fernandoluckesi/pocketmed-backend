import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Clinic } from '../entities/clinic.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { MercadoPagoService } from './mercadopago.service';

@Module({
  imports: [TypeOrmModule.forFeature([Clinic]), ConfigModule],
  controllers: [PaymentsController],
  providers: [StripeService, MercadoPagoService, PaymentsService],
  exports: [StripeService, MercadoPagoService, PaymentsService],
})
export class PaymentsModule {}
