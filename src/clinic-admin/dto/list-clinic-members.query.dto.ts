import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ProfessionalRole } from '../../auth/professional-role.enum';

export class ListClinicMembersQueryDto {
  @ApiPropertyOptional({ enum: ProfessionalRole })
  @IsOptional()
  @IsEnum(ProfessionalRole)
  role?: ProfessionalRole;

  @ApiPropertyOptional({ example: 'maria' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;
}
