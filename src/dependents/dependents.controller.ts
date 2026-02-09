import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { DependentsService } from './dependents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateDependentDto } from './dto/create-dependent.dto';
import { AddResponsibleDto } from './dto/add-responsible.dto';

@ApiTags('Dependents')
@Controller('dependents')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class DependentsController {
  constructor(private dependentsService: DependentsService) {}

  @Post()
  @Roles('patient')
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiOperation({ summary: 'Create a new dependent (patients only)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Dependent created successfully' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateDependentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.dependentsService.create(user.userId, dto, file);
  }

  @Get()
  @Roles('patient')
  @ApiOperation({ summary: 'Get all dependents for current patient' })
  @ApiResponse({ status: 200, description: 'Return all dependents' })
  async findAll(@CurrentUser() user: any) {
    return this.dependentsService.findAll(user.userId);
  }

  @Get(':id')
  @Roles('patient')
  @ApiOperation({ summary: 'Get dependent by ID' })
  @ApiResponse({ status: 200, description: 'Return dependent' })
  @ApiResponse({ status: 404, description: 'Dependent not found or no access' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.dependentsService.findOne(id, user.userId);
  }

  @Post(':id/add-responsible')
  @Roles('patient')
  @ApiOperation({ summary: 'Add a new responsible to dependent (admin only)' })
  @ApiResponse({ status: 200, description: 'Responsible added successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only admin can add responsibles' })
  @ApiResponse({ status: 404, description: 'Dependent or Patient not found' })
  async addResponsible(
    @Param('id') id: string,
    @Body() dto: AddResponsibleDto,
    @CurrentUser() user: any,
  ) {
    return this.dependentsService.addResponsible(id, dto.patientId, user.userId);
  }

  @Delete(':id')
  @Roles('patient')
  @ApiOperation({ summary: 'Delete dependent (admin only)' })
  @ApiResponse({ status: 200, description: 'Dependent deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only admin can delete' })
  @ApiResponse({ status: 404, description: 'Dependent not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.dependentsService.remove(id, user.userId);
  }
}
