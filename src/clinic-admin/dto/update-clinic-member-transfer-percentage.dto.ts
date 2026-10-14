import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min, ValidateIf } from 'class-validator';

export class UpdateClinicMemberTransferPercentageDto {
  @ApiProperty({
    example: 60,
    nullable: true,
    description:
      'Repasse percentage for this doctor at this clinic. Null clears the override and falls back to the clinic default.',
  })
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  transferPercentage: number | null;
}
