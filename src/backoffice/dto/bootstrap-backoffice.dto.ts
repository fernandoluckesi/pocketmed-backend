import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * Payload for the one-shot creation of the first back office account.
 * See BackofficeAuthService.bootstrapFirstUser for the safety constraints.
 */
export class BootstrapBackofficeDto {
  @ApiProperty({ description: 'Valor de BACKOFFICE_BOOTSTRAP_SECRET' })
  @IsString({ message: 'Informe o segredo de bootstrap.' })
  @MinLength(16, { message: 'O segredo deve ter ao menos 16 caracteres.' })
  secret: string;

  @ApiProperty({ example: 'Fernando Luckesi' })
  @IsString({ message: 'Informe o nome.' })
  @MinLength(3, { message: 'O nome deve ter ao menos 3 caracteres.' })
  name: string;

  @ApiProperty({ example: 'fernando.luckesi94@gmail.com' })
  @IsEmail({}, { message: 'Informe um email válido.' })
  email: string;

  @ApiProperty({ example: 'senha-forte-aleatoria' })
  @IsString({ message: 'Informe a senha.' })
  @MinLength(12, { message: 'A senha deve ter ao menos 12 caracteres.' })
  password: string;
}
