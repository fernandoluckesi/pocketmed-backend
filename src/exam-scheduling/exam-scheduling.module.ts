import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamSchedulingController } from './exam-scheduling.controller';
import { ExamSchedulingService } from './exam-scheduling.service';
import { ExamSchedule } from '../entities/exam-schedule.entity';
import { ExamScheduleItem } from '../entities/exam-schedule-item.entity';
import { Dependent } from '../entities/dependent.entity';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExamSchedule, ExamScheduleItem, Dependent]),
    UploadModule,
  ],
  controllers: [ExamSchedulingController],
  providers: [ExamSchedulingService],
  exports: [ExamSchedulingService],
})
export class ExamSchedulingModule {}
