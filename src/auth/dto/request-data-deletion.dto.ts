import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * What the requester wants done. Google Play requires the account-deletion
 * URL to also offer deleting *data* without deleting the account, so both are
 * modelled explicitly instead of being inferred from free text.
 */
export enum DeletionRequestType {
  /** Delete the account and all associated data. */
  ACCOUNT_AND_DATA = 'account_and_data',
  /** Delete data only, keeping the account active. */
  DATA_ONLY = 'data_only',
}

/**
 * Public (unauthenticated) deletion request, submitted from the web form
 * linked in the Google Play Data Safety section.
 *
 * Deliberately does NOT accept a password. The form is public, so accepting
 * credentials here would turn it into an unauthenticated login surface and a
 * credential-harvesting target. Identity is proven out-of-band: the request is
 * recorded and acknowledged, and the actual deletion still runs through the
 * authenticated, email-code-confirmed flow (`DELETE /auth/account`).
 */
export class RequestDataDeletionDto {
  @ApiProperty({ example: 'Maria Silva', description: 'Nome completo do titular' })
  @IsString()
  @IsNotEmpty({ message: 'Informe seu nome completo' })
  @MaxLength(255)
  fullName: string;

  @ApiProperty({ example: 'maria.silva@email.com', description: 'Email da conta' })
  @IsEmail({}, { message: 'Informe um email válido' })
  @IsNotEmpty({ message: 'Informe o email da conta' })
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: '(11) 99999-0000', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ enum: DeletionRequestType, example: DeletionRequestType.ACCOUNT_AND_DATA })
  @IsEnum(DeletionRequestType, { message: 'Selecione o tipo de solicitação' })
  requestType: DeletionRequestType;

  @ApiProperty({
    example: 'Não utilizo mais o aplicativo.',
    required: false,
    description: 'Motivo da solicitação (opcional)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  reason?: string;
}
