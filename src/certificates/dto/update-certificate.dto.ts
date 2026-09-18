import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsDateString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCertificateDto {
  @ApiProperty({ example: 'CRM/SP 123456', required: false })
  @IsString()
  @IsOptional()
  crm?: string;

  @ApiProperty({ example: 'J11', required: false })
  @IsString()
  @IsOptional()
  cid?: string;

  @ApiProperty({ example: 'Repouso domiciliar por síndrome gripal.', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 3, required: false })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  daysOff?: number;

  @ApiProperty({ example: '2026-03-15', required: false })
  @IsDateString()
  @IsOptional()
  issueDate?: string;
}
