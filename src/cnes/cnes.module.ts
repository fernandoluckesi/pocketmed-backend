import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CnesEstablishment } from '../entities/cnes-establishment.entity';
import { CnesController } from './cnes.controller';
import { CnesService } from './cnes.service';
import { IbgeService } from './ibge.service';

@Module({
  imports: [TypeOrmModule.forFeature([CnesEstablishment])],
  controllers: [CnesController],
  providers: [CnesService, IbgeService],
})
export class CnesModule {}
