import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsString,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExamRequestItemDto } from './create-exam-request.dto';

export class UpdateExamRequestDto {
  @ApiProperty({ example: '2026-03-15', required: false })
  @IsDateString()
  @IsOptional()
  issueDate?: string;

  @ApiProperty({ type: [ExamRequestItemDto], required: false })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExamRequestItemDto)
  @IsOptional()
  items?: ExamRequestItemDto[];

  @ApiProperty({ example: 'Paciente em jejum de 12 horas.', required: false })
  @IsString()
  @IsOptional()
  observations?: string;
}
