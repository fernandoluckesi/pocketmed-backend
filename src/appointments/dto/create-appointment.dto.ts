import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsIn,
} from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
    description: 'ID do médico cadastrado (se existir)',
  })
  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @ApiProperty({
    example: '123456',
    required: false,
    description: 'CRM do médico (obrigatório se doctorId não for fornecido)',
  })
  @IsString()
  @IsOptional()
  doctorCrm?: string;

  @ApiProperty({
    example: 'Dr. João Santos',
    required: false,
    description: 'Nome do médico (obrigatório se doctorId não for fornecido)',
  })
  @IsString()
  @IsOptional()
  doctorName?: string;

  @ApiProperty({
    example: 'Cardiologia',
    required: false,
    description: 'Especialidade do médico (obrigatório se doctorId não for fornecido)',
  })
  @IsString()
  @IsOptional()
  doctorSpecialty?: string;

  @ApiProperty({ example: 'Consulta de rotina para acompanhamento cardíaco' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ example: '2024-02-15T14:30:00Z' })
  @IsDateString()
  dateTime: string;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;

  @ApiProperty({ example: 'Paciente apresenta boa evolução no quadro cardíaco', required: false })
  @IsString()
  @IsOptional()
  doctorFeedback?: string;

  @ApiProperty({ example: 'Continuar com medicação atual e retornar em 3 meses', required: false })
  @IsString()
  @IsOptional()
  doctorInstructions?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsUUID()
  @IsOptional()
  dependentId?: string;

  @ApiProperty({ example: 'consulta', enum: ['consulta', 'retorno'], required: false })
  @IsIn(['consulta', 'retorno'])
  @IsOptional()
  visitType?: string;

  @ApiProperty({ example: 'particular', enum: ['particular', 'convenio'], required: false })
  @IsIn(['particular', 'convenio'])
  @IsOptional()
  paymentType?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsUUID()
  @IsOptional()
  convenioId?: string;
}
