import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MaxLength, Matches } from 'class-validator';

export class UpdateClinicDto {
  @ApiProperty({ example: 'Clínica Saúde Total', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

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

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: '01001-000', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(9)
  cep?: string;

  @ApiProperty({ example: 'Praça da Sé', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  street?: string;

  @ApiProperty({ example: '100', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string;

  @ApiProperty({ example: 'Sala 101', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  complement?: string;

  @ApiProperty({ example: 'Sé', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  neighborhood?: string;

  @ApiProperty({ example: 'São Paulo', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiProperty({ example: 'SP', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  noNumber?: boolean;
}
