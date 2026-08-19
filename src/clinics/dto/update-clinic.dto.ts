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
}
