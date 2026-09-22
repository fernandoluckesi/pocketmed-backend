import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Clinic } from '../entities/clinic.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [TypeOrmModule.forFeature([Clinic]), ConfigModule],
  controllers: [PaymentsController],
  providers: [StripeService, PaymentsService],
  exports: [StripeService],
})
export class PaymentsModule {}
