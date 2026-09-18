import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsBoolean, IsUUID, IsIn } from 'class-validator';

export class UpdateAppointmentDto {
  @ApiProperty({ example: 'Consulta de rotina para acompanhamento cardíaco', required: false })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    required: false,
    description: 'Reassign the appointment to another professional (clinic staff only)',
  })
  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @ApiProperty({ example: '2024-02-15T14:30:00Z', required: false })
  @IsDateString()
  @IsOptional()
  dateTime?: string;

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
