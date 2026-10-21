import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  verificationCode: string;
}
