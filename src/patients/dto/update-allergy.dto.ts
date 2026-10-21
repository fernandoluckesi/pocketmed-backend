import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateAllergyDto {
  @ApiProperty({ example: 'Penicilina', required: false })
  @IsOptional()
  @IsString()
  name?: string;

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
