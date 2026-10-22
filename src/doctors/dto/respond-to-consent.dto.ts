import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn, IsOptional, Matches } from 'class-validator';

export class RespondToConsentDto {
  @ApiProperty({ example: 'a1b2c3...' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'AUTHORIZE', enum: ['AUTHORIZE', 'DENY'] })
  @IsIn(['AUTHORIZE', 'DENY'])
  decision: 'AUTHORIZE' | 'DENY';

  @ApiProperty({
    example: '0105',
    required: false,
    description: 'Last 4 digits of the CPF on file — required to AUTHORIZE when the record has one',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'Deve conter exatamente 4 dígitos' })
  cpfLast4?: string;
}
