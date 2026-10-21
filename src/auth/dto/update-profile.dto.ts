import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Fernando Luckesi', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: '(11) 99999-1234', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Masculino', required: false })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ example: '1950-09-25', required: false })
  @IsOptional()
  @IsString()
  birthDate?: string;

  @ApiProperty({ example: 'Cardiologia', required: false })
  @IsOptional()
  @IsString()
  specialty?: string;

  /** @deprecated Prefer `crmNumber` + `crmUf`. */
  @ApiProperty({
    example: '198850/SP',
    required: false,
    description: 'Formato legado. Prefira crmNumber + crmUf.',
  })
  @IsOptional()
  @IsString()
  crm?: string;

  @ApiProperty({ example: '198850', required: false })
  @IsOptional()
  @IsString()
  crmNumber?: string;

  @ApiProperty({ example: 'SP', required: false })
  @IsOptional()
  @IsString()
  crmUf?: string;

  @ApiProperty({ example: '12345', required: false })
  @IsOptional()
  @IsString()
  rqe?: string;

  @ApiProperty({ example: '390.533.447-05', required: false })
  @IsOptional()
  @IsString()
  cpf?: string;

  @ApiProperty({ example: '123456', required: false })
  @IsOptional()
  @IsString()
  verificationCode?: string;
}
