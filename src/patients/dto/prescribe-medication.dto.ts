import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class PrescribeMedicationDto {
  @ApiProperty({ example: 'Dipirona' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '500mg' })
  @IsString()
  @IsNotEmpty()
  dosage: string;

  @ApiProperty({ example: 'A cada 6 horas' })
  @IsString()
  @IsNotEmpty()
  frequency: string;

  @ApiProperty({ example: '2024-06-15' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ example: '2024-06-22', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ example: 'Tomar após as refeições', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsOptional()
  @IsString()
  appointmentId?: string;
}
