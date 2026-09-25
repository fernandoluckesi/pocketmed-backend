import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicationCatalogController } from './medication-catalog.controller';
import { MedicationCatalogService } from './medication-catalog.service';
import { MedicationOrderParserService } from './medication-order-parser.service';
import { MedicationCatalog } from '../entities/medication-catalog.entity';
import { DocumentParsingModule } from '../document-parsing/document-parsing.module';

@Module({
  imports: [TypeOrmModule.forFeature([MedicationCatalog]), DocumentParsingModule],
  controllers: [MedicationCatalogController],
  providers: [MedicationCatalogService, MedicationOrderParserService],
  exports: [MedicationCatalogService],
})
export class MedicationCatalogModule {}
