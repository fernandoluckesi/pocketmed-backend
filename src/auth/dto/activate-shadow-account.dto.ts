import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ActivateShadowAccountDto {
  @ApiProperty({ example: 'fernando.luckesi.shadow@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  verificationCode: string;

  @ApiProperty({ example: '958969' })
  @IsString()
  @MinLength(6)
  password: string;
}
