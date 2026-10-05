import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsUUID,
  IsString,
  IsOptional,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExamRequestItemDto {
  @ApiProperty({ example: 'Hemograma completo' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreateExamRequestDto {
  @ApiProperty({ example: 'b555dc1b-0cdb-4a4f-810b-65d33a7e50aa', required: false })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiProperty({ example: 'b555dc1b-0cdb-4a4f-810b-65d33a7e50aa', required: false })
  @IsUUID()
  @IsOptional()
  dependentId?: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', required: false })
  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @ApiProperty({ example: '2026-03-15', required: false })
  @IsDateString()
  @IsOptional()
  issueDate?: string;

  @ApiProperty({ type: [ExamRequestItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExamRequestItemDto)
  items: ExamRequestItemDto[];

  @ApiProperty({ example: 'Paciente em jejum de 12 horas.', required: false })
  @IsString()
  @IsOptional()
  observations?: string;
}
