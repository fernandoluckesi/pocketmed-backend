import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  IsDateString,
  IsOptional,
  Matches,
} from 'class-validator';
import { IsCpf } from '../../common/validators/is-cpf.validator';
import { IsBrazilianUf } from '../../common/validators/is-brazilian-uf.validator';

export class RegisterDoctorDto {
  @ApiProperty({ example: 'Dr. Fernando Luckesi' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'dr.fernando.luckesi@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Senha@123' })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
  @Matches(/[A-Z]/, { message: 'A senha deve conter pelo menos uma letra maiúscula' })
  @Matches(/[a-z]/, { message: 'A senha deve conter pelo menos uma letra minúscula' })
  @Matches(/\d/, { message: 'A senha deve conter pelo menos um número' })
  @Matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, {
    message: 'A senha deve conter pelo menos um caractere especial',
  })
  password: string;

  @ApiProperty({ example: 'Masculino' })
  @IsString()
  @IsNotEmpty()
  gender: string;

  @ApiProperty({ example: 'Cardiologia' })
  @IsString()
  @IsNotEmpty()
  specialty: string;

  @ApiProperty({ example: '390.533.447-05' })
  @IsNotEmpty()
  @IsCpf()
  cpf: string;

  @ApiProperty({ example: '(11) 99248-6811' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '2002-06-08' })
  @IsDateString()
  birthDate: string;

  /**
   * @deprecated Prefer `crmNumber` + `crmUf`. Still accepted (and parsed
   * server-side) because mobile and the legacy web register screen deploy
   * independently and keep sending the combined string.
   */
  @ApiProperty({
    example: '198850/SP',
    required: false,
    description: 'Formato legado. Prefira crmNumber + crmUf.',
  })
  @IsString()
  @IsOptional()
  crm?: string;

  @ApiProperty({ example: '198850', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\d{1,15}$/, { message: 'crmNumber deve conter apenas dígitos' })
  crmNumber?: string;

  @ApiProperty({ example: 'SP', required: false })
  @IsString()
  @IsOptional()
  @IsBrazilianUf()
  crmUf?: string;

  @ApiProperty({ example: '12345', required: false })
  @IsString()
  @IsOptional()
  rqe?: string;

  @ApiProperty({ type: 'string', format: 'binary', required: false })
  @IsOptional()
  profileImage?: any;
}
