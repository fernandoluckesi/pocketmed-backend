import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Shared by exam-requests, prescriptions and reports — all three
 * `confirm-signature` endpoints accept the exact same shape.
 */
export class ConfirmSignatureDto {
  @ApiProperty({ example: 'ext-sig-123456' })
  @IsString()
  @IsNotEmpty()
  externalSignatureId: string;
}
