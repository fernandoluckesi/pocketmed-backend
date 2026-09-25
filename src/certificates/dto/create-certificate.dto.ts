import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, IsDateString, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCertificateDto {
  @ApiProperty({ example: 'CRM/SP 123456' })
  @IsString()
  @IsNotEmpty()
  crm: string;

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

  @ApiProperty({ example: 'b555dc1b-0cdb-4a4f-810b-65d33a7e50aa', required: false })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiProperty({ example: 'b555dc1b-0cdb-4a4f-810b-65d33a7e50aa', required: false })
  @IsUUID()
  @IsOptional()
  dependentId?: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', required: false })
  @IsUUID()
  @IsOptional()
  appointmentId?: string;
}
