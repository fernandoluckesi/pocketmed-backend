import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { IsBrazilianUf } from '../../common/validators/is-brazilian-uf.validator';

export class CreateShadowDoctorByAdminDto {
  @ApiProperty({ example: 'Dr. Maria Silva' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'maria.silva@clinic.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Feminino' })
  @IsString()
  @IsNotEmpty()
  gender: string;

  @ApiProperty({ example: 'Cardiologia' })
  @IsString()
  @IsNotEmpty()
  specialty: string;

  @ApiProperty({ example: '12345678900' })
  @IsString()
  @IsNotEmpty()
  cpf: string;

  @ApiProperty({ example: '(11) 99999-0000' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '1985-03-10' })
  @IsDateString()
  birthDate: string;

  /** @deprecated Prefer `crmNumber` + `crmUf`. */
  @ApiProperty({
    example: '12345/SP',
    required: false,
    description: 'Formato legado. Prefira crmNumber + crmUf.',
  })
  @IsString()
  @IsOptional()
  crm?: string;

  @ApiProperty({ example: '12345', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\d{1,15}$/, { message: 'crmNumber deve conter apenas dígitos' })
  crmNumber?: string;

  @ApiProperty({ example: 'SP', required: false })
  @IsString()
  @IsOptional()
  @IsBrazilianUf()
  crmUf?: string;

  @ApiProperty({ example: 'https://cdn.example.com/profile.jpg', required: false })
  @IsOptional()
  @IsString()
  profileImage?: string;
}
