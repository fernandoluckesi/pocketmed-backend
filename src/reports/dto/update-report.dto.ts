import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDateString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ReportType } from '../../entities/report.entity';
import { ProseMirrorDoc } from '../../documents/document.types';

export class UpdateReportDto {
  @ApiProperty({ enum: ReportType, required: false })
  @IsEnum(ReportType)
  @IsOptional()
  reportType?: ReportType;

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

  @ApiProperty({ example: 'Relatório de acompanhamento clínico', required: false })
  @IsString()
  @IsOptional()
  title?: string;

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
