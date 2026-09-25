import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';

/**
 * An already-authenticated doctor converting their own account into owning a
 * clinic — as opposed to CreateClinicDto, which signs up a brand new doctor
 * account together with a new clinic.
 */
export class ConvertToClinicDto {
  @ApiProperty({ example: 'Clínica Saúde Total', description: 'Nome da clínica' })
  @IsString()
  @IsNotEmpty({ message: 'O nome da clínica é obrigatório' })
  @MaxLength(255)
  clinicName: string;

  @ApiProperty({
    example: '56770702000109',
    description: 'CNPJ da clínica (somente números, 14 dígitos)',
  })
  @IsString()
  @IsNotEmpty({ message: 'CNPJ é obrigatório' })
  @Matches(/^\d{14}$/, {
    message: 'CNPJ deve conter exatamente 14 dígitos numéricos',
  })
  cnpj: string;

  @ApiProperty({ example: '01001-000', description: 'CEP (formato XXXXX-XXX ou XXXXXXXX)' })
  @IsString()
  @IsNotEmpty({ message: 'CEP é obrigatório' })
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP deve ter 8 dígitos (XXXXX-XXX ou XXXXXXXX)' })
  cep: string;

  @ApiProperty({ example: 'Praça da Sé', description: 'Logradouro' })
  @IsString()
  @IsNotEmpty({ message: 'Endereço é obrigatório' })
  @MaxLength(255)
  street: string;

  @ApiProperty({ example: '100', description: 'Número do endereço', required: false })
  @ValidateIf((o) => !o.noNumber)
  @IsString()
  @IsNotEmpty({ message: 'Número é obrigatório quando "Sem Número" não está marcado' })
  @MaxLength(20)
  number?: string;

  @ApiProperty({ example: 'Sala 101', description: 'Complemento', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  complement?: string;

  @ApiProperty({ example: 'Sé', description: 'Bairro' })
  @IsString()
  @IsNotEmpty({ message: 'Bairro é obrigatório' })
  @MaxLength(100)
  neighborhood: string;

  @ApiProperty({ example: 'São Paulo', description: 'Cidade' })
  @IsString()
  @IsNotEmpty({ message: 'Cidade é obrigatória' })
  @MaxLength(100)
  city: string;

  @ApiProperty({ example: 'SP', description: 'Estado (UF - 2 caracteres)' })
  @IsString()
  @IsNotEmpty({ message: 'Estado é obrigatório' })
  @MaxLength(2)
  state: string;

  @ApiProperty({
    example: false,
    description: 'Indica que o endereço não possui número',
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'noNumber deve ser um valor booleano' })
  noNumber?: boolean;

  @ApiProperty({
    example: 'plus',
    description: 'Plano escolhido (starter, plus, pro, premium, enterprise)',
  })
  @IsString()
  @IsNotEmpty({ message: 'planId é obrigatório' })
  planId: string;
}
