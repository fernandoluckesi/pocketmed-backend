import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  MaxLength,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { MAX_MONETARY_VALUE } from './financial-common';

/**
 * Cost center (centro de custo) for grouping expenses.
 *
 * `clinicId`/`id` excluded: the service derives clinicId from the active
 * clinic, and `code` uniqueness is checked per-clinic — accepting clinicId
 * from the body would let that check be aimed at another tenant's data.
 */
export class CreateCostCenterDto {
  @ApiProperty({ example: 'Infraestrutura' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'INFRA', description: 'Único por clínica.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiPropertyOptional({ example: 10000.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONETARY_VALUE)
  budgetAllocated?: number | null;

  @ApiPropertyOptional({ example: '#1F3AD9', description: 'Cor hex (#RGB ou #RRGGBB).' })
  @IsOptional()
  @IsString()
  // Constrained to a hex color because the column is varchar(7) and the web
  // UI renders it straight into a style attribute.
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'color must be a hex color such as #1F3AD9',
  })
  color?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;
}

/**
 * `active` is updatable here (the UI has no toggle today, but DELETE
 * soft-deletes by setting it to false, so allowing an explicit reactivation
 * is consistent rather than a new capability).
 */
export class UpdateCostCenterDto extends PartialType(CreateCostCenterDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
