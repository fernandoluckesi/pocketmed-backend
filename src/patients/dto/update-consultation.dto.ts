import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class UpdateConsultationDto {
  @ApiProperty({ example: '2024-06-15T09:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ example: 'Dor de cabeça e febre', required: false })
  @IsOptional()
  @IsString()
  symptoms?: string;

  @ApiProperty({ example: 'Enxaqueca', required: false })
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiProperty({ example: 'Dipirona 500mg a cada 6h', required: false })
  @IsOptional()
  @IsString()
  prescription?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiProperty({ example: 'consulta', required: false })
  @IsOptional()
  @IsString()
  visitType?: string;

  @ApiProperty({ example: 'particular', required: false })
  @IsOptional()
  @IsString()
  paymentType?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsOptional()
  @IsString()
  convenioId?: string;
}
