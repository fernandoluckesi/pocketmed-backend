import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsIn,
  IsDateString,
  MaxLength,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { CASHFLOW_TYPES, MAX_MONETARY_VALUE } from './financial-common';

/**
 * POST /financial/cashflow/adjustment — a manual cash-flow correction.
 *
 * This is the most sensitive write in the module: it moves the clinic's
 * balance directly, without a revenue or expense behind it. Hardened
 * accordingly:
 *  - `sourceType` is forced to 'AJUSTE' by the service and not accepted
 *    here, so a manual entry can never masquerade as a system-generated
 *    'RECEITA'/'DESPESA' one (which is what the DRE and reconciliation
 *    reports use to trace an entry back to its origin).
 *  - `sourceId` is likewise rejected: pointing an adjustment at an unrelated
 *    revenue/expense id would corrupt that traceability.
 *  - `reconciled` is forced to false — self-marking an adjustment as already
 *    reconciled would let it skip the review it exists for.
 *  - `balanceAfter` is a derived snapshot, never client-supplied.
 */
export class CreateCashflowAdjustmentDto {
  @ApiProperty({ enum: CASHFLOW_TYPES, description: 'ENTRADA (entrada de caixa) ou SAIDA.' })
  @IsIn(CASHFLOW_TYPES)
  type: string;

  @ApiProperty({ example: 'Ajuste de conciliação bancária' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @ApiProperty({ example: 150.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONETARY_VALUE)
  value: number;

  @ApiProperty({ example: '2026-10-19' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string | null;
}

/**
 * POST /financial/transfers/generate — materializes the calculated doctor
 * transfers for a reference month.
 *
 * Was `@Body() body: { month: string }`: a TS inline type, which produces no
 * runtime validation at all (same effective hole as `any`). An unparseable
 * month silently produced an empty/garbage date range instead of a 400.
 */
export class GenerateTransfersDto {
  @ApiProperty({ example: '2026-10', description: 'Mês de referência (YYYY-MM).' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be in YYYY-MM format',
  })
  month: string;
}
