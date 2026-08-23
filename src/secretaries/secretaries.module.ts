import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Secretary } from '../entities/secretary.entity';
import { SecretariesService } from './secretaries.service';
import { SecretariesController } from './secretaries.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([Secretary]), EmailModule],
  providers: [SecretariesService],
  controllers: [SecretariesController],
  exports: [SecretariesService],
})
export class SecretariesModule {}
