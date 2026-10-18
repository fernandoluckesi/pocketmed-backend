import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';

export class UpdateDependentDto {
  @ApiProperty({ example: 'João Silva', required: false })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'Masculino', required: false })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  gender?: string;

  @ApiProperty({ example: 'Filho', required: false })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  type?: string;

  @ApiProperty({ example: '1986-06-11', required: false })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiProperty({ type: 'string', format: 'binary', required: false })
  @IsOptional()
  profileImage?: any;
}
