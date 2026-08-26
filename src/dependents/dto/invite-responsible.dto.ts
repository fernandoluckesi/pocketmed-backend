import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class InviteResponsibleDto {
  @ApiProperty({ example: 'convidado@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
