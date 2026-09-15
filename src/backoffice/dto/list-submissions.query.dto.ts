import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const VERIFICATION_STATUSES = ['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const;

export class ListSubmissionsQueryDto {
  @ApiPropertyOptional({ enum: VERIFICATION_STATUSES, example: 'SUBMITTED' })
  @IsIn(VERIFICATION_STATUSES as unknown as string[])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Search by doctor name, email or CRM' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
