import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateAllergyDto {
  @ApiProperty({ example: 'Penicilina' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Grave', required: false })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiProperty({ example: 'Erupção cutânea', required: false })
  @IsOptional()
  @IsString()
  reaction?: string;

  @ApiProperty({ example: 'Confirmado por teste alérgico', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
