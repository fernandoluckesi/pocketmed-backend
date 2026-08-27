import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class CreateInviteDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'UUID do médico a ser convidado',
  })
  @IsUUID()
  @IsNotEmpty()
  doctorId: string;
}
