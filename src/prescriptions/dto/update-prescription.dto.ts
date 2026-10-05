import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsString,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrescriptionItemDto } from './create-prescription.dto';

export class UpdatePrescriptionDto {
  @ApiProperty({ example: '2026-03-15', required: false })
  @IsDateString()
  @IsOptional()
  issueDate?: string;

  @ApiProperty({ type: [PrescriptionItemDto], required: false })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  @IsOptional()
  items?: PrescriptionItemDto[];

  @ApiProperty({ example: 'Retornar em 7 dias se não houver melhora.', required: false })
  @IsString()
  @IsOptional()
  observations?: string;
}
