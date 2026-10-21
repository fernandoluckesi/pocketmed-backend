import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreateVaccineDto {
  @ApiProperty({ example: 'Hepatite B' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '1ª dose', required: false })
  @IsOptional()
  @IsString()
  dose?: string;

  @ApiProperty({ example: '2024-01-10', required: false })
  @IsOptional()
  @IsDateString()
  applicationDate?: string;

  @ApiProperty({ example: '2024-07-10', required: false })
  @IsOptional()
  @IsDateString()
  nextDoseDate?: string;

  @ApiProperty({ example: 'Laboratório São Lucas', required: false })
  @IsOptional()
  @IsString()
  laboratory?: string;

  @ApiProperty({ example: 'Sem reações adversas', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
