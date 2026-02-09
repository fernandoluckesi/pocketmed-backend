import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
} from 'class-validator';
import { ExamType, ExamStatus } from '../../entities/exam.entity';

export class UpdateExamDto {
  @ApiProperty({ example: 'Hemograma Completo', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'blood_test', enum: ExamType, required: false })
  @IsEnum(ExamType)
  @IsOptional()
  type?: ExamType;

  @ApiProperty({ example: 'Exame de sangue para verificar hemácias, leucócitos e plaquetas', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2024-03-15', required: false })
  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @ApiProperty({ example: 'completed', enum: ExamStatus, required: false })
  @IsEnum(ExamStatus)
  @IsOptional()
  status?: ExamStatus;

  @ApiProperty({ example: 'Resultados dentro dos parâmetros normais', required: false })
  @IsString()
  @IsOptional()
  results?: string;

  @ApiProperty({ example: 'Paciente em jejum', required: false })
  @IsString()
  @IsOptional()
  observations?: string;

  @ApiProperty({ example: 'Laboratório São Lucas', required: false })
  @IsString()
  @IsOptional()
  laboratory?: string;
}
