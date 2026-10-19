import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsIn,
  IsDateString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { FINANCIAL_STATUSES, MAX_MONETARY_VALUE } from './financial-common';

/**
 * Creating a revenue (receivable).
 *
 * Deliberately NOT accepted here, even though the columns exist:
 *  - `id`, `clinicId`: identity/tenant. clinicId comes from the JWT-resolved
 *    active clinic in the service; accepting it from the body is the exact
 *    cross-tenant hole this DTO closes.
 *  - `netValue`: always recomputed server-side as grossValue - discountValue.
 *    The web client does send it today (see web/src/services/financial.ts),
 *    which is why it's declared+ignored rather than rejected — see below.
 *  - `paidAt`: stamped by the server when status becomes PAGO, so the paid
 *    timestamp can't be backdated to fall outside a DRE/report window.
 *  - `glosaValue`/`glosaReason`: only settable through
 *    PATCH /revenues/:id/status, which is the path that also keeps the
 *    cash-flow consistent.
 */
export class CreateRevenueDto {
  @ApiProperty({ example: 'Consulta cardiológica' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  procedure: string;

  @ApiProperty({ example: 'Cardiologia' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  specialty: string;

  @ApiProperty({ example: 350.0, description: 'Valor bruto. netValue é calculado no servidor.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONETARY_VALUE)
  grossValue: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONETARY_VALUE)
  discountValue?: number;

  /**
   * Accepted but ignored: the service always recomputes netValue from
   * grossValue/discountValue. Declared only so the existing web client —
   * which posts it — doesn't start failing with 400 under
   * `forbidNonWhitelisted`. Do not read this value anywhere.
   */
  @ApiPropertyOptional({
    deprecated: true,
    description: 'Ignorado. Calculado no servidor como grossValue - discountValue.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  netValue?: number;

  @ApiProperty({ example: 'Convênio' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  paymentMethod: string;

  @ApiProperty({ example: '2026-11-15' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ enum: FINANCIAL_STATUSES, default: 'PENDENTE' })
  @IsOptional()
  @IsIn(FINANCIAL_STATUSES)
  status?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  patientId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  doctorId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  appointmentId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  convenioId?: string | null;

  @ApiPropertyOptional({ example: '10101012' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  procedureCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  invoiceNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  guideNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  authorizationNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  insurancePlanName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  insuranceCardNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}

/**
 * Updating a revenue: every create field becomes optional, and the same
 * fields stay forbidden. PartialType keeps the two in sync automatically —
 * adding a field to the create DTO shouldn't require remembering to mirror
 * it here.
 */
export class UpdateRevenueDto extends PartialType(CreateRevenueDto) {}

/**
 * PATCH /revenues/:id/status — the controlled path for status transitions.
 *
 * Separate from UpdateRevenueDto on purpose: this is the only route that may
 * set glosa fields, and the only one that writes a cash-flow entry when the
 * status becomes PAGO.
 */
export class UpdateRevenueStatusDto {
  @ApiProperty({ enum: FINANCIAL_STATUSES })
  @IsIn(FINANCIAL_STATUSES)
  status: string;

  @ApiPropertyOptional({ description: 'Somente quando status = GLOSADO.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONETARY_VALUE)
  glosaValue?: number;

  @ApiPropertyOptional({ description: 'Somente quando status = GLOSADO.' })
  @IsOptional()
  @IsString()
  glosaReason?: string;
}
