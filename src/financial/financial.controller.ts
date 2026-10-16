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
import { FinancialHighlightsService } from './highlights/financial-highlights.service';

@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class FinancialController {
  constructor(
    private readonly financialService: FinancialService,
    private readonly financialHighlightsService: FinancialHighlightsService,
  ) {}

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
  updateCostCenter(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: any) {
    return this.financialService.updateCostCenter(user.activeClinicId, id, dto);
  }

  @Delete('cost-centers/:id')
  deleteCostCenter(@CurrentUser() user: any, @Param('id') id: string) {
    return this.financialService.deleteCostCenter(user.activeClinicId, id);
  }

  // ─── CONVENIOS ────────────────────────────────────────────────────────────

  @Get('convenios')
  @Roles('doctor', 'admin', 'secretary')
  listConvenios(@CurrentUser() user: any) {
    return this.financialService.listConvenios(user.activeClinicId);
  }

  /**
   * Cross-clinic search, unlike listConvenios above: a patient has no active
   * clinic, so the insurance-plan picker in the patient app needs a global
   * lookup by name instead of "this clinic's list".
   */
  @Get('convenios/search')
  @Roles('doctor', 'admin', 'secretary', 'patient')
  searchConvenios(@Query('q') q: string) {
    return this.financialService.searchConvenios(q);
  }

  @Post('convenios')
  createConvenio(@CurrentUser() user: any, @Body() dto: any) {
    return this.financialService.createConvenio(user.activeClinicId, dto);
  }

  @Put('convenios/:id')
  updateConvenio(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: any) {
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

  // ─── CONVENIO PROCEDURES (remuneration table per convênio) ────────────────

  @Get('convenios/:convenioId/procedures')
  @Roles('doctor', 'admin', 'secretary')
  listConvenioProcedures(
    @CurrentUser() user: any,
    @Param('convenioId') convenioId: string,
  ) {
    return this.financialService.listConvenioProcedures(user.activeClinicId, convenioId);
  }

  @Post('convenios/:convenioId/procedures')
  createConvenioProcedure(
    @CurrentUser() user: any,
    @Param('convenioId') convenioId: string,
    @Body() dto: any,
  ) {
    return this.financialService.createConvenioProcedure(user.activeClinicId, convenioId, dto);
  }

  @Put('convenios/:convenioId/procedures/:id')
  updateConvenioProcedure(
    @CurrentUser() user: any,
    @Param('convenioId') convenioId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.financialService.updateConvenioProcedure(
      user.activeClinicId,
      convenioId,
      id,
      dto,
    );
  }

  @Delete('convenios/:convenioId/procedures/:id')
  deleteConvenioProcedure(
    @CurrentUser() user: any,
    @Param('convenioId') convenioId: string,
    @Param('id') id: string,
  ) {
    return this.financialService.deleteConvenioProcedure(user.activeClinicId, convenioId, id);
  }

  // ─── CONVENIO PLANS ────────────────────────────────────────────────────────

  @Get('convenios/:convenioId/plans')
  @Roles('doctor', 'admin', 'secretary')
  listConvenioPlans(@CurrentUser() user: any, @Param('convenioId') convenioId: string) {
    return this.financialService.listConvenioPlans(user.activeClinicId, convenioId);
  }

  @Post('convenios/:convenioId/plans')
  createConvenioPlan(
    @CurrentUser() user: any,
    @Param('convenioId') convenioId: string,
    @Body() dto: any,
  ) {
    return this.financialService.createConvenioPlan(user.activeClinicId, convenioId, dto);
  }

  @Put('convenios/:convenioId/plans/:id')
  updateConvenioPlan(
    @CurrentUser() user: any,
    @Param('convenioId') convenioId: string,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.financialService.updateConvenioPlan(user.activeClinicId, convenioId, id, dto);
  }

  @Delete('convenios/:convenioId/plans/:id')
  deleteConvenioPlan(
    @CurrentUser() user: any,
    @Param('convenioId') convenioId: string,
    @Param('id') id: string,
  ) {
    return this.financialService.deleteConvenioPlan(user.activeClinicId, convenioId, id);
  }

  // ─── TUSS PROCEDURES (official ANS code lookup for autocomplete) ──────────

  @Get('tuss-procedures/search')
  @Roles('doctor', 'admin', 'secretary')
  searchTussProcedures(@Query('q') q: string) {
    return this.financialService.searchTussProcedures(q);
  }

  @Get('tuss-procedures/common')
  @Roles('doctor', 'admin', 'secretary')
  getCommonTussProcedures(@CurrentUser() user: any) {
    return this.financialService.getCommonTussProcedures(user.activeClinicId);
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
    @Query('minValue') minValue?: string,
    @Query('maxValue') maxValue?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.financialService.listRevenues(user.activeClinicId, {
      status,
      doctorId,
      convenioId,
      startDate,
      endDate,
      minValue: minValue ? parseFloat(minValue) : undefined,
      maxValue: maxValue ? parseFloat(maxValue) : undefined,
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
  updateRevenue(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: any) {
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
    @Query('minValue') minValue?: string,
    @Query('maxValue') maxValue?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.financialService.listExpenses(user.activeClinicId, {
      status,
      category,
      costCenterId,
      startDate,
      endDate,
      minValue: minValue ? parseFloat(minValue) : undefined,
      maxValue: maxValue ? parseFloat(maxValue) : undefined,
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
  updateExpense(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: any) {
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
  calculateTransfers(@CurrentUser() user: any, @Query('month') month: string) {
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
  getDRE(@CurrentUser() user: any, @Query('year') year: string, @Query('month') month: string) {
    return this.financialService.getDRE(
      user.activeClinicId,
      parseInt(year, 10),
      parseInt(month, 10),
    );
  }

  // ─── DASHBOARD ────────────────────────────────────────────────────────────

  @Get('dashboard/kpis')
  getDashboardKPIs(
    @CurrentUser() user: any,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.financialService.getDashboardKPIs(
      user.activeClinicId,
      year ? parseInt(year, 10) : undefined,
      month ? parseInt(month, 10) : undefined,
    );
  }

  @Get('dashboard/highlights')
  getHighlights(
    @CurrentUser() user: any,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.financialHighlightsService.getHighlights(
      user.activeClinicId,
      year ? parseInt(year, 10) : undefined,
      month ? parseInt(month, 10) : undefined,
    );
  }

  @Get('dashboard/revenue-by-specialty')
  getRevenueBySpecialty(
    @CurrentUser() user: any,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.financialService.getRevenueBySpecialty(
      user.activeClinicId,
      year ? parseInt(year, 10) : undefined,
      month ? parseInt(month, 10) : undefined,
    );
  }

  @Get('dashboard/recent-transactions')
  getRecentTransactions(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.financialService.getRecentTransactions(
      user.activeClinicId,
      limit ? parseInt(limit, 10) : 10,
      status,
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
    return this.financialService.getRevenueReport(user.activeClinicId, {
      startDate,
      endDate,
      doctorId,
      convenioId,
    });
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
    return this.financialService.getGlosaReport(user.activeClinicId, {
      startDate,
      endDate,
      convenioId,
    });
  }

  @Get('reports/expenses-by-cost-center')
  getExpensesByCostCenterReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('costCenterId') costCenterId?: string,
  ) {
    return this.financialService.getExpensesByCostCenterReport(user.activeClinicId, {
      startDate,
      endDate,
      costCenterId,
    });
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
