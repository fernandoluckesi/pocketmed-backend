import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmEmailChangeDto {
  @ApiProperty({ example: '123456', description: 'Code sent to the new email' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
