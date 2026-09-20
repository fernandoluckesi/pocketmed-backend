import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class VerifyEmailDto {
  // Verification code is optional while token/code validation is disabled for
  // the Apple review build. Kept in the DTO for compatibility with the client.
  @ApiProperty({ example: '123456', required: false })
  @IsOptional()
  @IsString()
  code?: string;
}
