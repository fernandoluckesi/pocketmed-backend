import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamCatalogController } from './exam-catalog.controller';
import { ExamCatalogService } from './exam-catalog.service';
import { ExamOrderParserService } from './exam-order-parser.service';
import { ExamCatalog } from '../entities/exam-catalog.entity';
import { ExamCategory } from '../entities/exam-category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ExamCatalog, ExamCategory])],
  controllers: [ExamCatalogController],
  providers: [ExamCatalogService, ExamOrderParserService],
  exports: [ExamCatalogService],
})
export class ExamCatalogModule {}
