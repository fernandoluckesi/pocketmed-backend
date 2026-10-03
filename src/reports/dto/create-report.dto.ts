import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsObject,
} from 'class-validator';
import { ReportType } from '../../entities/report.entity';
import { ProseMirrorDoc } from '../../documents/document.types';

export class CreateReportDto {
  @ApiProperty({ example: 'b555dc1b-0cdb-4a4f-810b-65d33a7e50aa', required: false })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiProperty({ example: 'b555dc1b-0cdb-4a4f-810b-65d33a7e50aa', required: false })
  @IsUUID()
  @IsOptional()
  dependentId?: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', required: false })
  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @ApiProperty({ enum: ReportType })
  @IsEnum(ReportType)
  reportType: ReportType;

  @ApiProperty({ example: 'Avaliação pós-operatória', required: false })
  @IsString()
  @IsOptional()
  reportTypeOther?: string;

  @ApiProperty({ example: '2026-03-15', required: false })
  @IsDateString()
  @IsOptional()
  issueDate?: string;

  @ApiProperty({ example: '2026-03-10', required: false })
  @IsDateString()
  @IsOptional()
  relatedServiceDate?: string;

  @ApiProperty({ example: 'Encaminhamento para especialista', required: false })
  @IsString()
  @IsOptional()
  purpose?: string;

  @ApiProperty({ example: 'Relatório de acompanhamento clínico' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ required: false, description: 'Tiptap/ProseMirror JSON content' })
  @IsObject()
  @IsOptional()
  chiefComplaint?: ProseMirrorDoc;

  @ApiProperty({ required: false, description: 'Tiptap/ProseMirror JSON content' })
  @IsObject()
  @IsOptional()
  clinicalHistory?: ProseMirrorDoc;

  @ApiProperty({ required: false, description: 'Tiptap/ProseMirror JSON content' })
  @IsObject()
  @IsOptional()
  physicalExam?: ProseMirrorDoc;

  @ApiProperty({ required: false, description: 'Tiptap/ProseMirror JSON content' })
  @IsObject()
  @IsOptional()
  complementaryExams?: ProseMirrorDoc;

  @ApiProperty({ required: false, description: 'Tiptap/ProseMirror JSON content' })
  @IsObject()
  @IsOptional()
  results?: ProseMirrorDoc;

  @ApiProperty({ required: false, description: 'Tiptap/ProseMirror JSON content' })
  @IsObject()
  @IsOptional()
  diagnosis?: ProseMirrorDoc;

  @ApiProperty({ required: false, description: 'Tiptap/ProseMirror JSON content' })
  @IsObject()
  @IsOptional()
  conclusion?: ProseMirrorDoc;

  @ApiProperty({ required: false, description: 'Tiptap/ProseMirror JSON content' })
  @IsObject()
  @IsOptional()
  recommendations?: ProseMirrorDoc;

  @ApiProperty({ required: false, description: 'Tiptap/ProseMirror JSON content' })
  @IsObject()
  @IsOptional()
  observations?: ProseMirrorDoc;
}
