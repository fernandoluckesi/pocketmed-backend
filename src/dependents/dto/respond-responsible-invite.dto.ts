import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ResponsibleInviteStatus } from '../../entities/dependent-responsible-invite.entity';

export class RespondResponsibleInviteDto {
  @ApiProperty({ enum: ResponsibleInviteStatus, example: ResponsibleInviteStatus.ACCEPTED })
  @IsEnum(ResponsibleInviteStatus)
  status: ResponsibleInviteStatus;
}
