import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CheckProfileAvailabilityDto {
  @ApiProperty({ example: '390.533.447-05', required: false })
  @IsOptional()
  @IsString()
  cpf?: string;

  @ApiProperty({ example: '(11) 99999-1234', required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}
