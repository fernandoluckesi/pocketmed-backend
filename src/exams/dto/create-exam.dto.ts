import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ExamType, ExamStatus } from '../../entities/exam.entity';

export class CreateExamDto {
  @ApiProperty({ example: 'Hemograma Completo' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'blood_test', enum: ExamType })
  @IsEnum(ExamType)
  type: ExamType;

  @ApiProperty({ example: 'Exame de sangue para verificar hemácias, leucócitos e plaquetas', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2024-03-15', required: false })
  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @ApiProperty({ example: 'scheduled', enum: ExamStatus, required: false })
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

  @ApiProperty({ example: 'b555dc1b-0cdb-4a4f-810b-65d33a7e50aa', required: false })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiProperty({ example: 'b555dc1b-0cdb-4a4f-810b-65d33a7e50aa', required: false })
  @IsUUID()
  @IsOptional()
  dependentId?: string;

  @ApiProperty({ example: 'b555dc1b-0cdb-4a4f-810b-65d33a7e50aa', required: false })
  @IsUUID()
  @IsOptional()
  appointmentId?: string;
}
