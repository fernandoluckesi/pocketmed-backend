import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsArray,
  IsDateString,
  IsInt,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { MedicationFrequency } from '../../entities/medication.entity';

export class UpdateMedicationDto {
  @ApiProperty({ example: 'Paracetamol', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: '500mg', required: false })
  @IsString()
  @IsOptional()
  dosage?: string;

  @ApiProperty({ example: 'twice_daily', enum: MedicationFrequency, required: false })
  @IsEnum(MedicationFrequency)
  @IsOptional()
  frequency?: MedicationFrequency;

  @ApiProperty({ example: ['08:00', '20:00'], required: false })
  @IsArray()
  @IsOptional()
  times?: string[];

  @ApiProperty({ example: '2024-02-03', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: '2024-12-01', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: 30, required: false })
  @IsInt()
  @IsOptional()
  duration?: number;

  @ApiProperty({ example: 'Tomar após as refeições', required: false })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isFinished?: boolean;

  @ApiProperty({ example: 'b555dc1b-0cdb-4a4f-810b-65d33a7e50aa', required: false })
  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @ApiProperty({ example: 'b555dc1b-0cdb-4a4f-810b-65d33a7e50aa', required: false })
  @IsUUID()
  @IsOptional()
  attachmentId?: string;
}
