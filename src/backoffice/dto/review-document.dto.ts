import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectDocumentDto {
  @ApiProperty({
    example: 'Documento ilegível, reenvie uma cópia com melhor resolução.',
    description: 'Reason shown to the doctor. Required so the doctor can act on it.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  rejectionReason: string;
}

export class ApproveDocumentDto {
  @ApiPropertyOptional({ example: 'Conferido com o CRM-SP.' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  note?: string;
}
