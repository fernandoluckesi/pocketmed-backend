import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, MinLength, IsDateString, IsBoolean, IsOptional } from 'class-validator';

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

  @ApiProperty({ example: '958969' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '(11) 99999-1234' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '1950-09-25' })
  @IsDateString()
  birthDate: string;

  @ApiProperty({ type: 'string', format: 'binary', required: false })
  @IsOptional()
  profileImage?: any;
}
