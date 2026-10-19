import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  IsBoolean,
  IsEmail,
  IsDateString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { MAX_PERCENTAGE } from './financial-common';

/**
 * Convênio (health insurance operator) registered by a clinic.
 *
 * `clinicId`/`id` excluded — same tenant-pinning reasoning as the other
 * financial DTOs. `ansCode` uniqueness is enforced per-clinic in the service.
 */
export class CreateConvenioDto {
  @ApiProperty({ example: 'Unimed' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: '326305', description: 'Registro ANS. Único por clínica.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  ansCode: string;

  @ApiProperty({ example: 'CBHPM', description: 'Tabela contratada.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  contractTable: string;

  @ApiProperty({ example: 30, description: 'Prazo de pagamento em dias.' })
  @IsInt()
  @Min(0)
  // One year: a payment term beyond this is a data-entry error, and it feeds
  // the receivables aging/inadimplência reports.
  @Max(365)
  paymentTerm: number;

  @ApiProperty({ example: 5.0, description: 'Tolerância de glosa (%).' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PERCENTAGE)
  glosaTolerance: number;

  @ApiPropertyOptional({ example: 10.0, description: 'Markup sobre a tabela (%).' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PERCENTAGE)
  markupPercentage?: number | null;

  @ApiPropertyOptional({ example: '12.345.678/0001-90' })
  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string | null;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  contractStartDate?: string | null;

  @ApiPropertyOptional({ example: '2027-01-01' })
  @IsOptional()
  @IsDateString()
  contractEndDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}

/**
 * `active` is included because PATCH /convenios/:id/toggle already flips it;
 * exposing it here doesn't widen what an admin can do.
 */
export class UpdateConvenioDto extends PartialType(CreateConvenioDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/**
 * A clinic's remuneration table entry for one procedure under one convênio.
 *
 * `convenioId` is taken from the URL path, not the body — accepting it in
 * both places would let the two disagree, and the service validates the path
 * one against the clinic before writing.
 */
export class CreateConvenioProcedureDto {
  @ApiProperty({ example: '10101012', description: 'Código TUSS.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  procedureCode: string;

  @ApiProperty({ example: 'Consulta em consultório' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  procedureName: string;

  @ApiProperty({ example: 120.0, description: 'Valor pago por este convênio.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  // Procedure values share the decimal(10,2) column bound.
  @Max(99999999.99)
  value: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateConvenioProcedureDto extends PartialType(CreateConvenioProcedureDto) {}

/** Insurance plan offered under a convênio (e.g. "Premium"). */
export class CreateConvenioPlanDto {
  @ApiProperty({ example: 'Premium' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateConvenioPlanDto extends PartialType(CreateConvenioPlanDto) {}
