import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches } from 'class-validator';

export class SearchDoctorDto {
  @ApiProperty({
    example: '123456',
    description: 'Número do CRM (1 a 10 dígitos numéricos)',
  })
  @IsNotEmpty({ message: 'CRM e Estado são obrigatórios' })
  @Matches(/^\d{1,10}$/, {
    message: 'CRM deve conter de 1 a 10 dígitos numéricos',
  })
  crm: string;

  @ApiProperty({
    example: 'SP',
    description: 'Sigla do estado (UF com 2 letras)',
  })
  @IsNotEmpty({ message: 'CRM e Estado são obrigatórios' })
  @Matches(/^[A-Z]{2}$/, {
    message: 'Estado deve ser uma UF válida com 2 letras maiúsculas',
  })
  state: string;
}
