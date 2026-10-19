import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsIn, MaxLength, Min, Max } from 'class-validator';
import { TAX_REGIMES, MAX_PERCENTAGE } from './financial-common';

/**
 * PUT /financial/settings — upsert of a clinic's financial configuration.
 *
 * All fields optional (it's a partial update over an auto-created row), but
 * `clinicId` and `id` are not accepted: the service pins clinicId from the
 * JWT-resolved active clinic. Letting it through the body would allow an
 * admin of clinic A to overwrite clinic B's tax rates and bank details.
 *
 * The rate fields feed the DRE and the doctor-transfer math, so they're
 * bounded to 0–100 rather than taking any number: a negative or >100 rate
 * would silently produce nonsensical transfer amounts and DRE lines rather
 * than failing visibly.
 */
export class UpdateFinancialSettingsDto {
  @ApiPropertyOptional({ enum: TAX_REGIMES })
  @IsOptional()
  @IsIn(TAX_REGIMES)
  taxRegime?: string;

  @ApiPropertyOptional({ example: 5.0, description: 'Alíquota ISS (%).' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PERCENTAGE)
  issRate?: number;

  @ApiPropertyOptional({ example: 6.0, description: 'Alíquota DAS (%).' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PERCENTAGE)
  dasRate?: number;

  @ApiPropertyOptional({ example: 0, description: 'Alíquota IRPJ (%).' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PERCENTAGE)
  irpjRate?: number;

  @ApiPropertyOptional({ example: 0, description: 'Alíquota CSLL (%).' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PERCENTAGE)
  csllRate?: number;

  @ApiPropertyOptional({ example: 50.0, description: 'Repasse padrão ao médico (%).' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PERCENTAGE)
  defaultDoctorTransferPercentage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  bankAgency?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bankAccount?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  pixKey?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  invoicePrefix?: string | null;
}
