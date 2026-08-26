import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
import { DependentsService } from './dependents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateDependentDto } from './dto/create-dependent.dto';
import { AddResponsibleDto } from './dto/add-responsible.dto';
import { InviteResponsibleDto } from './dto/invite-responsible.dto';
import { RespondResponsibleInviteDto } from './dto/respond-responsible-invite.dto';

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

  @Post('responsible-invites/:id/respond')
  @Roles('patient')
  @ApiOperation({ summary: 'Accept or reject a responsible invite (invitee only)' })
  @ApiResponse({ status: 200, description: 'Invite responded successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only the invitee can respond' })
  @ApiResponse({ status: 404, description: 'Invite not found' })
  async respondToInvite(
    @Param('id') id: string,
    @Body() dto: RespondResponsibleInviteDto,
    @CurrentUser() user: any,
  ) {
    return this.dependentsService.respondToInvite(id, dto.status, user.userId);
  }

  @Get(':id/search-user')
  @Roles('patient')
  @ApiOperation({ summary: 'Search an active user by exact email to invite as responsible' })
  @ApiQuery({ name: 'email', description: 'Exact email of the user to invite' })
  @ApiResponse({ status: 200, description: 'Return matching user' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only admin can invite' })
  @ApiResponse({ status: 404, description: 'Dependent or user not found' })
  async searchUser(
    @Param('id') id: string,
    @Query('email') email: string,
    @CurrentUser() user: any,
  ) {
    return this.dependentsService.searchUserByEmail(id, email, user.userId);
  }

  @Post(':id/invite-responsible')
  @Roles('patient')
  @ApiOperation({ summary: 'Invite a user (by email) to become a responsible (admin only)' })
  @ApiResponse({ status: 201, description: 'Invite sent successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only admin can invite' })
  @ApiResponse({ status: 404, description: 'Dependent or user not found' })
  async inviteResponsible(
    @Param('id') id: string,
    @Body() dto: InviteResponsibleDto,
    @CurrentUser() user: any,
  ) {
    return this.dependentsService.inviteResponsible(id, dto.email, user.userId);
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
