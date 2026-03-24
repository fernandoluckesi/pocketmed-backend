import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ProfessionalRole } from '../../auth/professional-role.enum';

export class UpdateClinicMemberRoleDto {
  @ApiProperty({ enum: ProfessionalRole, example: ProfessionalRole.SECRETARY })
  @IsEnum(ProfessionalRole)
  role: ProfessionalRole;
}
