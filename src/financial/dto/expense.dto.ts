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
 * Recurrence values accepted for an expense. The web client currently sends
 * 'AVULSO' while the entity column defaults to 'UNICA' — both are allowed
 * here so neither the existing UI nor existing rows break, rather than
 * silently normalizing one into the other (which would change the meaning of
 * data already stored).
 */
export const EXPENSE_RECURRENCES = [
  'UNICA',
  'AVULSO',
  'MENSAL',
  'TRIMESTRAL',
  'SEMESTRAL',
  'ANUAL',
] as const;

/**
 * Creating an expense (payable).
 *
 * Not accepted (server-owned, same reasoning as CreateRevenueDto):
 * `id`, `clinicId`, `paidAt`, and `netValue` (recomputed as
 * grossValue + taxValue).
 */
export class CreateExpenseDto {
  @ApiProperty({ example: 'Aluguel' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  category: string;

  @ApiProperty({ example: 'Imobiliária Central' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  provider: string;

  @ApiProperty({ example: 4500.0, description: 'Valor bruto. netValue é calculado no servidor.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONETARY_VALUE)
  grossValue: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONETARY_VALUE)
  taxValue?: number;

  /**
   * Accepted but ignored — recomputed as grossValue + taxValue. Declared
   * only because the existing web client posts it; see the same note on
   * CreateRevenueDto.netValue.
   */
  @ApiPropertyOptional({
    deprecated: true,
    description: 'Ignorado. Calculado no servidor como grossValue + taxValue.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  netValue?: number;

  @ApiProperty({ example: 'Transferência' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  paymentMethod: string;

  @ApiProperty({ example: '2026-11-10' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ enum: FINANCIAL_STATUSES, default: 'PENDENTE' })
  @IsOptional()
  @IsIn(FINANCIAL_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: EXPENSE_RECURRENCES, default: 'UNICA' })
  @IsOptional()
  @IsIn(EXPENSE_RECURRENCES)
  recurrence?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  costCenterId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subcategory?: string | null;

  @ApiPropertyOptional({ example: '12.345.678/0001-90' })
  @IsOptional()
  @IsString()
  @MaxLength(18)
  providerCnpj?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  invoiceNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  attachmentUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
