import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsDateString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateClinicDto {
  // ── Dados da Clínica ──────────────────────────────────────────────────────
  @ApiProperty({ example: 'Clínica Saúde Total', description: 'Nome da clínica' })
  @IsString()
  @IsNotEmpty({ message: 'O nome da clínica é obrigatório' })
  @MaxLength(255)
  clinicName: string;

  @ApiProperty({
    example: '12.345.678/0001-99',
    description: 'CNPJ da clínica (formato XX.XXX.XXX/XXXX-XX)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(18)
  @Matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, {
    message: 'CNPJ deve estar no formato XX.XXX.XXX/XXXX-XX',
  })
  cnpj?: string;

  // ── Dados do Médico Admin ─────────────────────────────────────────────────
  @ApiProperty({ example: 'Dr. Fernando Luckesi' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'dr.fernando@email.com' })
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

  @ApiProperty({ example: '12345', required: false })
  @IsString()
  @IsOptional()
  rqe?: string;

  @ApiProperty({ type: 'string', format: 'binary', required: false })
  @IsOptional()
  profileImage?: any;
}
