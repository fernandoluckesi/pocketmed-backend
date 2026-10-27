import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SendSupportMessageDto {
  @ApiProperty({
    example: 'Olá, estou com uma dúvida sobre o agendamento de consultas.',
    description: 'The support message typed by the user.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Digite uma mensagem.' })
  @MaxLength(5000, { message: 'A mensagem é muito longa.' })
  message: string;
}
