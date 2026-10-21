import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateAttachmentDto {
  @ApiProperty({
    example: 'receita',
    required: false,
    description: 'Deve ser "receita" ou "guia" (validado no controller)',
  })
  @IsOptional()
  @IsString()
  kind?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsOptional()
  @IsString()
  appointmentId?: string;
}
