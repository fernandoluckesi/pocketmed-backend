import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, MinLength, IsDateString, IsBoolean, IsOptional, Matches } from 'class-validator';

export class RegisterPatientDto {
  @ApiProperty({ example: 'Fernando Luckesi' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'fernando.luckesi@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Masculino' })
  @IsString()
  @IsNotEmpty()
  gender: string;

  @ApiProperty({ example: 'Senha@123' })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
  @Matches(/[A-Z]/, { message: 'A senha deve conter pelo menos uma letra maiúscula' })
  @Matches(/[a-z]/, { message: 'A senha deve conter pelo menos uma letra minúscula' })
  @Matches(/\d/, { message: 'A senha deve conter pelo menos um número' })
  @Matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, { message: 'A senha deve conter pelo menos um caractere especial' })
  password: string;

  @ApiProperty({ example: '(11) 99999-1234' })
  @IsOptional()
  @IsString()
  phone: string;

  @ApiProperty({ example: '1950-09-25' })
  @IsDateString()
  birthDate: string;

  @ApiProperty({ type: 'string', format: 'binary', required: false })
  @IsOptional()
  profileImage?: any;
}
