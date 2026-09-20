import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicationCatalogController } from './medication-catalog.controller';
import { MedicationCatalogService } from './medication-catalog.service';
import { MedicationCatalog } from '../entities/medication-catalog.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MedicationCatalog])],
  controllers: [MedicationCatalogController],
  providers: [MedicationCatalogService],
  exports: [MedicationCatalogService],
})
export class MedicationCatalogModule {}
