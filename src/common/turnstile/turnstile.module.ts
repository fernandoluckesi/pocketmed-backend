import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TurnstileService } from './turnstile.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
    }),
  ],
  providers: [TurnstileService],
  exports: [TurnstileService],
})
export class TurnstileModule {}
