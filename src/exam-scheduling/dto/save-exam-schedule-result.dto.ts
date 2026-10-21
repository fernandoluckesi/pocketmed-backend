import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SaveExamScheduleResultDto {
  @ApiProperty({ example: 'Hemograma dentro dos parâmetros normais', required: false })
  @IsOptional()
  @IsString()
  resultText?: string;
}
