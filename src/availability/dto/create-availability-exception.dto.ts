import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { AvailabilityExceptionType } from '../../entities/availability-exception.entity';

export class CreateAvailabilityExceptionDto {
  @ApiPropertyOptional({
    enum: AvailabilityExceptionType,
    example: AvailabilityExceptionType.SINGLE,
  })
  @IsEnum(AvailabilityExceptionType)
  @IsOptional()
  type?: AvailabilityExceptionType;

  @ApiPropertyOptional({ example: '2026-03-25' })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ example: '2026-03-25' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-03-30' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  fullDay?: boolean;

  @ApiPropertyOptional({ example: '09:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ example: '12:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ example: 'Compromisso externo' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  @IsOptional()
  doctorId?: string;
}
