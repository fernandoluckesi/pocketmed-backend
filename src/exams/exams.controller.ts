import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ExamsService } from './exams.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';

@ApiTags('Exams')
@Controller('exams')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ExamsController {
  constructor(private examsService: ExamsService) {}

  @Post()
  @Roles('doctor')
  @UseInterceptors(FileInterceptor('resultFile'))
  @ApiOperation({ summary: 'Create exam (doctors only)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Exam created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - No permission' })
  @ApiResponse({ status: 404, description: 'Patient or Dependent not found' })
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateExamDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.examsService.create(user.userId, dto, file);
  }

  @Get()
  @ApiOperation({ summary: 'Get all exams for current user' })
  @ApiResponse({ status: 200, description: 'Return exams' })
  async findAll(@CurrentUser() user: any) {
    return this.examsService.findAll(user.userId, user.type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get exam by ID' })
  @ApiResponse({ status: 200, description: 'Return exam' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.examsService.findOne(id, user.userId, user.type);
  }

  @Put(':id')
  @Roles('doctor')
  @UseInterceptors(FileInterceptor('resultFile'))
  @ApiOperation({ summary: 'Update exam (doctor who created only)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Exam updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateExamDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.examsService.update(id, user.userId, user.type, dto, file);
  }

  @Delete(':id')
  @Roles('doctor')
  @ApiOperation({ summary: 'Delete exam (doctor who created only)' })
  @ApiResponse({ status: 200, description: 'Exam deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.examsService.delete(id, user.userId, user.type);
  }
}
