import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';

export class RespondInviteDto {
  @ApiProperty({
    example: 'accepted',
    enum: ['accepted', 'rejected'],
    description: 'Decisão do médico: aceitar ou rejeitar o convite',
  })
  @IsIn(['accepted', 'rejected'], {
    message: "Valor de decisão inválido. Use 'accepted' ou 'rejected'",
  })
  @IsNotEmpty()
  decision: 'accepted' | 'rejected';
}
