import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ExamSchedulingService } from './exam-scheduling.service';
import { CreateExamScheduleDto } from './dto/create-exam-schedule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Exam Scheduling')
@Controller('exam-schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('patient')
@ApiBearerAuth('JWT-auth')
export class ExamSchedulingController {
  constructor(private readonly examSchedulingService: ExamSchedulingService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new exam schedule for the authenticated patient' })
  @ApiResponse({ status: 201, description: 'Exam schedule created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request — empty exam list or past date' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@CurrentUser() user: any, @Body() dto: CreateExamScheduleDto) {
    return this.examSchedulingService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all exam schedules for the authenticated patient' })
  @ApiResponse({ status: 200, description: 'Returns list of exam schedules' })
  async findAll(@CurrentUser() user: any) {
    return this.examSchedulingService.findAllByPatient(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single exam schedule by id' })
  @ApiResponse({ status: 200, description: 'Returns the exam schedule' })
  @ApiResponse({ status: 400, description: 'Not found or forbidden' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.examSchedulingService.findOneByPatient(id, user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update status, scheduledDateTime or exams of an exam schedule' })
  @ApiResponse({ status: 200, description: 'Updated successfully' })
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body()
    body: {
      status?: string;
      scheduledDateTime?: string;
      exams?: { examCatalogId?: string | null; customExamName?: string | null }[];
    },
  ) {
    return this.examSchedulingService.update(id, user.userId, body);
  }

  @Patch(':id/result')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Save the exam result (text and/or file) and mark as confirmed' })
  @ApiResponse({ status: 200, description: 'Result saved successfully' })
  async saveResult(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { resultText?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.examSchedulingService.saveResult(id, user.userId, body, file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an exam schedule' })
  @ApiResponse({ status: 204, description: 'Deleted successfully' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.examSchedulingService.remove(id, user.userId);
  }
}
