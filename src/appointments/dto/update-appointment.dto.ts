import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class UpdateAppointmentDto {
  @ApiProperty({ example: 'Consulta de rotina para acompanhamento cardíaco', required: false })
  @IsString()
  @IsOptional()
  reason?: string;

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
