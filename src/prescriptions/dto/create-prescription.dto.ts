import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsUUID,
  IsString,
  IsOptional,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PrescriptionItemDto {
  @ApiProperty({ example: 'Amoxicilina' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '500mg', required: false })
  @IsString()
  @IsOptional()
  concentration?: string;

  @ApiProperty({ example: 'Comprimido', required: false })
  @IsString()
  @IsOptional()
  pharmaceuticalForm?: string;

  @ApiProperty({ example: '21 comprimidos', required: false })
  @IsString()
  @IsOptional()
  quantity?: string;

  @ApiProperty({ example: '1 comprimido a cada 8 horas', required: false })
  @IsString()
  @IsOptional()
  posology?: string;

  @ApiProperty({ example: 'Oral', required: false })
  @IsString()
  @IsOptional()
  routeOfAdministration?: string;

  @ApiProperty({ example: '7 dias', required: false })
  @IsString()
  @IsOptional()
  treatmentDuration?: string;
}

export class CreatePrescriptionDto {
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

  @ApiProperty({ example: '2026-03-15', required: false })
  @IsDateString()
  @IsOptional()
  issueDate?: string;

  @ApiProperty({ type: [PrescriptionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];

  @ApiProperty({ example: 'Retornar em 7 dias se não houver melhora.', required: false })
  @IsString()
  @IsOptional()
  observations?: string;
}
