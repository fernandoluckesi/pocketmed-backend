import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class LookupPatientByEmailDto {
  @ApiProperty({ example: 'ana.maria@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
