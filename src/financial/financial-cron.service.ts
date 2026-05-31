import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FinancialService } from './financial.service';

@Injectable()
export class FinancialCronService {
  private readonly logger = new Logger(FinancialCronService.name);

  constructor(private readonly financialService: FinancialService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'financial-overdue-check' })
  async handleOverdueCheck() {
    this.logger.log('Running daily overdue check...');
    try {
      const result = await this.financialService.markOverdueItems();
      this.logger.log(`Overdue check complete: ${result.overdueRevenues} revenues, ${result.overdueExpenses} expenses marked as VENCIDO`);
    } catch (error) {
      this.logger.error('Failed to run overdue check', error);
    }
  }
}
