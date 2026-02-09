import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class AddResponsibleDto {
  @ApiProperty({ example: 'e4020b30-de97-4424-89b6-77d7943f2fe4' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;
}
