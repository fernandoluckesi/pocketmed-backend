import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsBoolean, IsUUID } from 'class-validator';

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
}
