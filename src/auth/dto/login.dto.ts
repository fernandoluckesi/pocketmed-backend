import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'fernando.luckesi@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '958969' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'patient', required: false, description: 'Login as patient or doctor (optional)' })
  @IsOptional()
  @IsString()
  loginAs?: string;
}
