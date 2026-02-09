import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsString } from 'class-validator';

export class RequestAccessDto {
  @ApiProperty({ example: 'e4020b30-de97-4424-89b6-77d7943f2fe4', required: false })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiProperty({ example: 'e4020b30-de97-4424-89b6-77d7943f2fe4', required: false })
  @IsUUID()
  @IsOptional()
  dependentId?: string;

  @ApiProperty({ example: 'Gostaria de acessar seu histórico médico para consulta', required: false })
  @IsString()
  @IsOptional()
  message?: string;
}
