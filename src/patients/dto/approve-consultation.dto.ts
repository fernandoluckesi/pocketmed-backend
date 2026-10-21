import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class ApproveConsultationDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  @IsNotEmpty()
  approved: boolean;
}
