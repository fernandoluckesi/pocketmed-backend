import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { AvailabilityRule } from '../entities/availability-rule.entity';
import { AvailabilityException } from '../entities/availability-exception.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AvailabilityRule, AvailabilityException])],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
