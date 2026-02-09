import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'fernando.luckesi@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
