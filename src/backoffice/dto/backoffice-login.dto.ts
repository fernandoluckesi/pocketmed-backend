import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class BackofficeLoginDto {
  @ApiProperty({ example: 'analista@hispora.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senha-forte' })
  @IsString()
  @MinLength(8)
  password: string;
}
