import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class UpdateDiseaseDto {
  @ApiProperty({ example: 'Diabetes tipo 2', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'Diagnóstico confirmado por exame laboratorial', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Paciente em acompanhamento regular', required: false })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiProperty({ example: 'active', required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ example: '2024-01-10', required: false })
  @IsOptional()
  @IsDateString()
  diagnosisDate?: string;

  @ApiProperty({ example: '2024-01-15', required: false })
  @IsOptional()
  @IsDateString()
  treatmentStartDate?: string;

  @ApiProperty({ example: '2024-06-15', required: false })
  @IsOptional()
  @IsDateString()
  treatmentEndDate?: string;
}
