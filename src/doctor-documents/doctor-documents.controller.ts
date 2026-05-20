import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DoctorDocumentsService } from './doctor-documents.service';

@Controller('doctors/documents')
export class DoctorDocumentsController {
  constructor(private readonly documentsService: DoctorDocumentsService) {}

  @Post(':type')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('type') type: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    const doctorId = req.user.userId;
    return this.documentsService.uploadDocument(doctorId, type.toUpperCase(), file);
  }

  @Get()
  async getMyDocuments(@Request() req) {
    const doctorId = req.user.userId;
    return this.documentsService.getDocumentsByDoctor(doctorId);
  }

  @Get('status')
  async getVerificationStatus(@Request() req) {
    const doctorId = req.user.userId;
    return this.documentsService.getVerificationStatus(doctorId);
  }
}
