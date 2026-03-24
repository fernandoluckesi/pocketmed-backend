import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';
import { ProfessionalRole } from '../../auth/professional-role.enum';

export class AddClinicMemberDto {
  @ApiProperty({ example: 'doctor@example.com' })
  @IsEmail()
  professionalEmail: string;

  @ApiProperty({ enum: ProfessionalRole, example: ProfessionalRole.DOCTOR })
  @IsEnum(ProfessionalRole)
  role: ProfessionalRole;
}
