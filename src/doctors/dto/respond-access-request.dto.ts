import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { AccessRequestStatus } from '../../entities/doctor-access-request.entity';

export class RespondAccessRequestDto {
  @ApiProperty({ example: 'approved', enum: AccessRequestStatus })
  @IsEnum(AccessRequestStatus)
  @IsNotEmpty()
  status: AccessRequestStatus;
}
