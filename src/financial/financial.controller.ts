import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FinancialService } from './financial.service';

@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 'financial' };
  }

  // ─── SETTINGS ─────────────────────────────────────────────────────────────

  @Get('settings')
  getSettings(@CurrentUser() user: any) {
    return this.financialService.getSettings(user.activeClinicId);
  }

  @Put('settings')
  updateSettings(@CurrentUser() user: any, @Body() dto: any) {
    return this.financialService.updateSettings(user.activeClinicId, dto);
  }

  // ─── COST CENTERS ─────────────────────────────────────────────────────────

  @Get('cost-centers')
  listCostCenters(@CurrentUser() user: any) {
    return this.financialService.listCostCenters(user.activeClinicId);
  }

  @Post('cost-centers')
  createCostCenter(@CurrentUser() user: any, @Body() dto: any) {
    return this.financialService.createCostCenter(user.activeClinicId, dto);
  }

  @Put('cost-centers/:id')
  updateCostCenter(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.financialService.updateCostCenter(user.activeClinicId, id, dto);
  }

  @Delete('cost-centers/:id')
  deleteCostCenter(@CurrentUser() user: any, @Param('id') id: string) {
    return this.financialService.deleteCostCenter(user.activeClinicId, id);
  }

  // ─── CONVENIOS ────────────────────────────────────────────────────────────

  @Get('convenios')
  listConvenios(@CurrentUser() user: any) {
    return this.financialService.listConvenios(user.activeClinicId);
  }

  @Post('convenios')
  createConvenio(@CurrentUser() user: any, @Body() dto: any) {
    return this.financialService.createConvenio(user.activeClinicId, dto);
  }

  @Put('convenios/:id')
  updateConvenio(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.financialService.updateConvenio(user.activeClinicId, id, dto);
  }

  @Patch('convenios/:id/toggle')
  @HttpCode(HttpStatus.OK)
  toggleConvenio(@CurrentUser() user: any, @Param('id') id: string) {
    return this.financialService.toggleConvenio(user.activeClinicId, id);
  }

  @Delete('convenios/:id')
  deleteConvenio(@CurrentUser() user: any, @Param('id') id: string) {
    return this.financialService.deleteConvenio(user.activeClinicId, id);
  }

  // ─── REVENUES ─────────────────────────────────────────────────────────────

  @Get('revenues')
  listRevenues(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('doctorId') doctorId?: string,
    @Query('convenioId') convenioId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.financialService.listRevenues(user.activeClinicId, {
      status,
      doctorId,
      convenioId,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('revenues/summary')
  getRevenueSummary(@CurrentUser() user: any) {
    return this.financialService.getRevenueSummary(user.activeClinicId);
  }

  @Post('revenues')
  createRevenue(@CurrentUser() user: any, @Body() dto: any) {
    return this.financialService.createRevenue(user.activeClinicId, dto);
  }

  @Put('revenues/:id')
  updateRevenue(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.financialService.updateRevenue(user.activeClinicId, id, dto);
  }

  @Patch('revenues/:id/status')
  @HttpCode(HttpStatus.OK)
  updateRevenueStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { status: string; glosaValue?: number; glosaReason?: string },
  ) {
    return this.financialService.updateRevenueStatus(
      user.activeClinicId,
      id,
      body.status,
      body.glosaValue,
      body.glosaReason,
    );
  }

  @Delete('revenues/:id')
  deleteRevenue(@CurrentUser() user: any, @Param('id') id: string) {
    return this.financialService.deleteRevenue(user.activeClinicId, id);
  }

  // ─── EXPENSES ─────────────────────────────────────────────────────────────

  @Get('expenses')
  listExpenses(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('costCenterId') costCenterId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.financialService.listExpenses(user.activeClinicId, {
      status,
      category,
      costCenterId,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('expenses/summary')
  getExpenseSummary(@CurrentUser() user: any) {
    return this.financialService.getExpenseSummary(user.activeClinicId);
  }

  @Post('expenses')
  createExpense(@CurrentUser() user: any, @Body() dto: any) {
    return this.financialService.createExpense(user.activeClinicId, dto);
  }

  @Put('expenses/:id')
  updateExpense(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.financialService.updateExpense(user.activeClinicId, id, dto);
  }

  @Patch('expenses/:id/pay')
  @HttpCode(HttpStatus.OK)
  payExpense(@CurrentUser() user: any, @Param('id') id: string) {
    return this.financialService.payExpense(user.activeClinicId, id);
  }

  @Delete('expenses/:id')
  deleteExpense(@CurrentUser() user: any, @Param('id') id: string) {
    return this.financialService.deleteExpense(user.activeClinicId, id);
  }

  // ─── DOCTOR TRANSFERS ─────────────────────────────────────────────────────

  @Get('transfers/my')
  @Roles('doctor', 'admin')
  getMyTransfers(@CurrentUser() user: any) {
    return this.financialService.getMyTransfers(user.userId);
  }

  @Get('transfers')
  listTransfers(
    @CurrentUser() user: any,
    @Query('month') month?: string,
    @Query('doctorId') doctorId?: string,
    @Query('status') status?: string,
  ) {
    return this.financialService.listTransfers(user.activeClinicId, {
      month,
      doctorId,
      status,
    });
  }

  @Get('transfers/calculate')
  calculateTransfers(
    @CurrentUser() user: any,
    @Query('month') month: string,
  ) {
    return this.financialService.calculateTransfers(user.activeClinicId, month);
  }

  @Post('transfers/generate')
  generateTransfers(@CurrentUser() user: any, @Body() body: { month: string }) {
    return this.financialService.generateTransfers(user.activeClinicId, body.month);
  }

  @Patch('transfers/:id/approve')
  @HttpCode(HttpStatus.OK)
  approveTransfer(@CurrentUser() user: any, @Param('id') id: string) {
    return this.financialService.approveTransfer(user.activeClinicId, id);
  }

  @Patch('transfers/:id/pay')
  @HttpCode(HttpStatus.OK)
  payTransfer(@CurrentUser() user: any, @Param('id') id: string) {
    return this.financialService.payTransfer(user.activeClinicId, id);
  }

  // ─── CASHFLOW ─────────────────────────────────────────────────────────────

  @Get('cashflow')
  listCashflow(
    @CurrentUser() user: any,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.financialService.listCashflow(user.activeClinicId, {
      type,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('cashflow/balance')
  getBalance(@CurrentUser() user: any) {
    return this.financialService.getBalance(user.activeClinicId);
  }

  @Post('cashflow/adjustment')
  createAdjustment(@CurrentUser() user: any, @Body() dto: any) {
    return this.financialService.createAdjustment(user.activeClinicId, dto);
  }

  @Patch('cashflow/:id/reconcile')
  @HttpCode(HttpStatus.OK)
  reconcileEntry(@CurrentUser() user: any, @Param('id') id: string) {
    return this.financialService.reconcileEntry(user.activeClinicId, id);
  }

  // ─── DRE ──────────────────────────────────────────────────────────────────

  @Get('dre')
  getDRE(
    @CurrentUser() user: any,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.financialService.getDRE(
      user.activeClinicId,
      parseInt(year, 10),
      parseInt(month, 10),
    );
  }

  // ─── DASHBOARD ────────────────────────────────────────────────────────────

  @Get('dashboard/kpis')
  getDashboardKPIs(@CurrentUser() user: any) {
    return this.financialService.getDashboardKPIs(user.activeClinicId);
  }

  @Get('dashboard/revenue-by-specialty')
  getRevenueBySpecialty(@CurrentUser() user: any) {
    return this.financialService.getRevenueBySpecialty(user.activeClinicId);
  }

  @Get('dashboard/recent-transactions')
  getRecentTransactions(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
  ) {
    return this.financialService.getRecentTransactions(
      user.activeClinicId,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  // ─── REPORTS ──────────────────────────────────────────────────────────────

  @Get('reports/revenue')
  getRevenueReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('doctorId') doctorId?: string,
    @Query('convenioId') convenioId?: string,
  ) {
    return this.financialService.getRevenueReport(user.activeClinicId, { startDate, endDate, doctorId, convenioId });
  }

  @Get('reports/inadimplencia')
  getInadimplenciaReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('minValue') minValue?: string,
  ) {
    return this.financialService.getInadimplenciaReport(user.activeClinicId, {
      startDate,
      endDate,
      minValue: minValue ? parseFloat(minValue) : undefined,
    });
  }

  @Get('reports/glosas')
  getGlosaReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('convenioId') convenioId?: string,
  ) {
    return this.financialService.getGlosaReport(user.activeClinicId, { startDate, endDate, convenioId });
  }

  @Get('reports/expenses-by-cost-center')
  getExpensesByCostCenterReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('costCenterId') costCenterId?: string,
  ) {
    return this.financialService.getExpensesByCostCenterReport(user.activeClinicId, { startDate, endDate, costCenterId });
  }

  @Get('reports/productivity')
  getProductivityReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.financialService.getProductivityReport(user.activeClinicId, { startDate, endDate });
  }

  // ─── OVERDUE JOB (manual trigger for admin) ───────────────────────────────

  @Post('jobs/mark-overdue')
  @HttpCode(HttpStatus.OK)
  markOverdueItems() {
    return this.financialService.markOverdueItems();
  }
}
