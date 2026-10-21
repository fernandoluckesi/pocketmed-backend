import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ example: 'Laudo de ressonância magnética', required: false })
  @IsOptional()
  @IsString()
  title?: string;
}
