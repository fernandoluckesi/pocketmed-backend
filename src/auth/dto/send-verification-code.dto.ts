import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendVerificationCodeDto {
  @ApiProperty({ example: 'fernando.luckesi.shadow@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
