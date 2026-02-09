import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString, IsUUID, IsOptional, IsBoolean } from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  doctorCrm: string;

  @ApiProperty({ example: 'Dr. João Santos' })
  @IsString()
  @IsNotEmpty()
  doctorName: string;

  @ApiProperty({ example: 'Cardiologia' })
  @IsString()
  @IsNotEmpty()
  doctorSpecialty: string;

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
}
