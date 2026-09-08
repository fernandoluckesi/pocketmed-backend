import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class TransferAdminDto {
  @ApiProperty({
    example: 'e4020b30-de97-4424-89b6-77d7943f2fe4',
    description: 'Patient id of the new admin (must already be a responsible for the dependent)',
  })
  @IsUUID()
  @IsNotEmpty()
  newAdminId: string;
}
