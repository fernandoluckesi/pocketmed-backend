import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateCheckoutSessionDto {
  @ApiProperty({
    example: 'plus',
    description:
      'Plano escolhido (starter, plus, pro ou premium — enterprise não tem checkout self-serve)',
  })
  @IsString()
  planId: string;

  @ApiProperty({
    example: 2,
    description: 'Vagas extras de profissional a contratar junto com o plano',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  additionalProfessionals?: number;
}
