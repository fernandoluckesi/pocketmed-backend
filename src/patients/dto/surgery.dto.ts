import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsDateString } from 'class-validator';

/**
 * Shared by create and update (PUT) — matches the previous `SurgeryData`
 * interface, which was an interface (erased at compile time, same lack of
 * runtime validation as an inline type). Enum checks and conditional
 * business rules (e.g. "implant fields only when hasPermanentImplant") stay
 * in `PatientsService.validateSurgeryData` — this DTO only enforces that
 * each provided field has the right basic type.
 */
export class SurgeryDto {
  @ApiProperty({ example: 'Apendicectomia', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'PERFORMED', required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ example: '2024-03-10', required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  date?: string | null;

  @ApiProperty({ example: 'Dor abdominal aguda', required: false, nullable: true })
  @IsOptional()
  @IsString()
  indication?: string | null;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false, nullable: true })
  @IsOptional()
  @IsString()
  diagnosisId?: string | null;

  @ApiProperty({ example: 'Abdômen', required: false, nullable: true })
  @IsOptional()
  @IsString()
  bodyRegion?: string | null;

  @ApiProperty({ example: 'N/A', required: false, nullable: true })
  @IsOptional()
  @IsString()
  laterality?: string | null;

  @ApiProperty({ example: 'Hospital São Lucas', required: false, nullable: true })
  @IsOptional()
  @IsString()
  hospitalOrClinic?: string | null;

  @ApiProperty({ example: 'Dr. Carlos Souza', required: false, nullable: true })
  @IsOptional()
  @IsString()
  surgeonName?: string | null;

  @ApiProperty({ example: 'Cirurgia Geral', required: false, nullable: true })
  @IsOptional()
  @IsString()
  surgeonSpecialty?: string | null;

  @ApiProperty({ example: 'São Paulo', required: false, nullable: true })
  @IsOptional()
  @IsString()
  city?: string | null;

  @ApiProperty({ example: 'SP', required: false, nullable: true })
  @IsOptional()
  @IsString()
  state?: string | null;

  @ApiProperty({ example: 'Aberta', required: false, nullable: true })
  @IsOptional()
  @IsString()
  surgeryType?: string | null;

  @ApiProperty({ example: 'Laparotomia', required: false, nullable: true })
  @IsOptional()
  @IsString()
  technique?: string | null;

  @ApiProperty({ example: 'Geral', required: false, nullable: true })
  @IsOptional()
  @IsString()
  anesthesia?: string | null;

  @ApiProperty({ example: 'Sucesso, sem intercorrências', required: false, nullable: true })
  @IsOptional()
  @IsString()
  outcome?: string | null;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  hadComplications?: boolean;

  @ApiProperty({ example: 'Infecção leve no sítio cirúrgico', required: false, nullable: true })
  @IsOptional()
  @IsString()
  complications?: string | null;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  hospitalAdmission?: boolean;

  @ApiProperty({ example: '2024-03-12', required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  dischargeDate?: string | null;

  @ApiProperty({ example: 'Recuperação dentro do esperado', required: false, nullable: true })
  @IsOptional()
  @IsString()
  postoperativeNotes?: string | null;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  hasPermanentImplant?: boolean;

  @ApiProperty({ example: 'Prótese', required: false, nullable: true })
  @IsOptional()
  @IsString()
  implantType?: string | null;

  @ApiProperty({ example: 'Prótese de quadril', required: false, nullable: true })
  @IsOptional()
  @IsString()
  implantDescription?: string | null;

  @ApiProperty({ example: 'Zimmer Biomet', required: false, nullable: true })
  @IsOptional()
  @IsString()
  implantManufacturer?: string | null;

  @ApiProperty({ example: 'XR-500', required: false, nullable: true })
  @IsOptional()
  @IsString()
  implantModel?: string | null;

  @ApiProperty({ example: 'SN-123456', required: false, nullable: true })
  @IsOptional()
  @IsString()
  implantSerial?: string | null;

  @ApiProperty({ example: 'Quadril direito', required: false, nullable: true })
  @IsOptional()
  @IsString()
  implantLocation?: string | null;
}
