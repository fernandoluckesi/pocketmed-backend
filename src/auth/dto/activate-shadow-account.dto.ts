import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, IsOptional, MinLength, Matches } from 'class-validator';

export class ActivateShadowAccountDto {
  @ApiProperty({ example: 'fernando.luckesi.shadow@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  // Optional while code validation is disabled for the Apple review build.
  @ApiProperty({ example: '123456', required: false })
  @IsOptional()
  @IsString()
  verificationCode?: string;

  @ApiProperty({ example: 'Senha@123' })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
  @Matches(/[A-Z]/, { message: 'A senha deve conter pelo menos uma letra maiúscula' })
  @Matches(/[a-z]/, { message: 'A senha deve conter pelo menos uma letra minúscula' })
  @Matches(/\d/, { message: 'A senha deve conter pelo menos um número' })
  @Matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, { message: 'A senha deve conter pelo menos um caractere especial' })
  password: string;
}
