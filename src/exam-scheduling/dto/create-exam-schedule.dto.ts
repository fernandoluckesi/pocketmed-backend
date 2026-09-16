import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  ArrayMinSize,
  ValidateNested,
  IsUUID,
  IsString,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExamItemDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Exam catalog ID (null for custom exams)',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  examCatalogId?: string | null;

  @ApiProperty({
    example: 'Hemograma especial',
    description: 'Custom exam name (used when examCatalogId is not provided)',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customExamName?: string | null;
}

export class CreateExamScheduleDto {
  @ApiProperty({
    description: 'List of exams to schedule (catalog or custom)',
    type: [ExamItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExamItemDto)
  exams: ExamItemDto[];

  @ApiProperty({
    example: '2024-06-15T09:00:00.000Z',
    description:
      'Scheduled date and time in ISO 8601 format. Optional: an exam prescribed during a consultation may not be scheduled yet.',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  scheduledDateTime?: string | null;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description:
      'Dependent ID when scheduling for a dependent. Omit to schedule for the authenticated patient.',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  dependentId?: string | null;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Appointment ID when the exam is created from a consultation.',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  appointmentId?: string | null;
}
