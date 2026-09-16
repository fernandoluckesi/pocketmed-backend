import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectDocumentDto {
  @ApiProperty({
    example: 'Documento ilegível, reenvie uma cópia com melhor resolução.',
    description: 'Reason shown to the doctor. Required so the doctor can act on it.',
  })
  @IsString({ message: 'Informe o motivo da rejeição.' })
  @MinLength(10, { message: 'O motivo deve ter ao menos 10 caracteres.' })
  @MaxLength(1000, { message: 'O motivo deve ter no máximo 1000 caracteres.' })
  rejectionReason: string;
}

export class ApproveDocumentDto {
  @ApiPropertyOptional({ example: 'Conferido com o CRM-SP.' })
  @IsString({ message: 'A observação deve ser um texto.' })
  @IsOptional()
  @MaxLength(1000, { message: 'A observação deve ter no máximo 1000 caracteres.' })
  note?: string;
}
