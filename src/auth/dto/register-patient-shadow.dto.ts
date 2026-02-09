import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, IsDateString, IsUUID, IsOptional } from 'class-validator';

export class RegisterPatientShadowDto {
  @ApiProperty({ example: 'Fernando Luckesi Shadow' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'fernando.luckesi.shadow@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Masculino' })
  @IsString()
  @IsNotEmpty()
  gender: string;

  @ApiProperty({ example: '(11) 99999-0000' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '1950-09-25' })
  @IsDateString()
  birthDate: string;

  @ApiProperty({ example: 'e4020b30-de97-4424-89b6-77d7943f2fe4' })
  @IsUUID()
  @IsNotEmpty()
  doctorCreatorId: string;

  @ApiProperty({ type: 'string', format: 'binary', required: false })
  @IsOptional()
  profileImage?: any;
}
