import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ConfirmEmailChangeDto {
  // Optional while code validation is disabled for the Apple review build.
  @ApiProperty({ example: '123456', description: 'Code sent to the new email', required: false })
  @IsOptional()
  @IsString()
  code?: string;
}
