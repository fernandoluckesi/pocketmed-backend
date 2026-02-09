import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, MinLength, IsDateString, IsOptional } from 'class-validator';

export class RegisterDoctorDto {
  @ApiProperty({ example: 'Dr. Fernando Luckesi' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'dr.fernando.luckesi@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '958969' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Masculino' })
  @IsString()
  @IsNotEmpty()
  gender: string;

  @ApiProperty({ example: 'Cardiologia' })
  @IsString()
  @IsNotEmpty()
  specialty: string;

  @ApiProperty({ example: '42275937862' })
  @IsString()
  @IsNotEmpty()
  cpf: string;

  @ApiProperty({ example: '(11) 99248-6811' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '2002-06-08' })
  @IsDateString()
  birthDate: string;

  @ApiProperty({ example: '198850/SP' })
  @IsString()
  @IsNotEmpty()
  crm: string;

  @ApiProperty({ type: 'string', format: 'binary', required: false })
  @IsOptional()
  profileImage?: any;
}
