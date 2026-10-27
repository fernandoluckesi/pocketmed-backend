import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsEmail } from 'class-validator';

export class SendPublicSupportMessageDto {
  @ApiProperty({ example: 'Maria Silva', description: "Sender's name." })
  @IsString()
  @IsNotEmpty({ message: 'Informe seu nome.' })
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'maria@email.com', description: "Sender's email." })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(255)
  email: string;

  @ApiProperty({
    example: 'Não consigo acessar minha conta.',
    description: 'The support message.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Digite uma mensagem.' })
  @MaxLength(5000, { message: 'A mensagem é muito longa.' })
  message: string;
}
