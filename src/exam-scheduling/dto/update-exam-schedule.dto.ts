import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  ValidateNested,
  IsUUID,
  IsString,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExamItemDto } from './create-exam-schedule.dto';

export class UpdateExamScheduleDto {
  @ApiProperty({ example: 'scheduled', required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ example: '2024-06-15T09:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  scheduledDateTime?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiProperty({
    description: 'Replaces the exam list when provided',
    type: [ExamItemDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamItemDto)
  exams?: ExamItemDto[];
}
