import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateSubscriptionDto {
  @ApiProperty({
    example: 'plus',
    description: 'Plano escolhido (starter, plus, pro, premium, enterprise)',
    required: false,
  })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiProperty({
    example: 2,
    description: 'Vagas extras de profissional além do limite incluso no plano',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  additionalProfessionals?: number;
}
