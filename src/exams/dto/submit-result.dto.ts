import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

export class SubmitResultDto {
  @ApiProperty({ example: '2024-06-15T09:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
