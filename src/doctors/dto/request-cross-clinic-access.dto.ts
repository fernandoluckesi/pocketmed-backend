import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RequestCrossClinicAccessDto {
  @ApiProperty({ example: 'Preparação de consulta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  purpose: string;
}
