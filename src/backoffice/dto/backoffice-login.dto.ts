import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class BackofficeLoginDto {
  @ApiProperty({ example: 'analista@hispora.com' })
  @IsEmail({}, { message: 'Informe um email válido.' })
  email: string;

  @ApiProperty({ example: 'senha-forte' })
  @IsString({ message: 'Informe a senha.' })
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres.' })
  password: string;
}
