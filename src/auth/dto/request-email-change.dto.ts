import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class RequestEmailChangeDto {
  @ApiProperty({ example: 'novo.email@email.com' })
  @IsEmail()
  newEmail: string;

  @ApiProperty({ example: 'Senha@123', description: 'Current account password' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
