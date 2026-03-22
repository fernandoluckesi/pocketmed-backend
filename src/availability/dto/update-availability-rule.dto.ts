import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateAvailabilityRuleDto {
  @ApiPropertyOptional({ example: 'Minha Regra' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: {
      monday: { enabled: true, intervals: [{ start: '09:00', end: '17:00' }] },
    },
  })
  @IsObject()
  @IsOptional()
  weekly?: Record<string, any>;

  @ApiPropertyOptional({ example: 30 })
  @IsInt()
  @Min(1)
  @IsOptional()
  duration?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsInt()
  @Min(0)
  @IsOptional()
  buffer?: number;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  @IsOptional()
  doctorId?: string;
}
