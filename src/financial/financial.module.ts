import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancialController } from './financial.controller';
import { FinancialService } from './financial.service';
import { FinancialCronService } from './financial-cron.service';
import { FinancialSettings } from '../entities/financial-settings.entity';
import { FinancialCostCenter } from '../entities/financial-cost-center.entity';
import { FinancialConvenio } from '../entities/financial-convenio.entity';
import { FinancialConvenioProcedure } from '../entities/financial-convenio-procedure.entity';
import { FinancialRevenue } from '../entities/financial-revenue.entity';
import { FinancialExpense } from '../entities/financial-expense.entity';
import { FinancialDoctorTransfer } from '../entities/financial-doctor-transfer.entity';
import { FinancialCashflowEntry } from '../entities/financial-cashflow-entry.entity';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { TussProcedure } from '../entities/tuss-procedure.entity';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinancialSettings,
      FinancialCostCenter,
      FinancialConvenio,
      FinancialConvenioProcedure,
      FinancialRevenue,
      FinancialExpense,
      FinancialDoctorTransfer,
      FinancialCashflowEntry,
      ClinicMembership,
      TussProcedure,
    ]),
    UploadModule,
  ],
  controllers: [FinancialController],
  providers: [FinancialService, FinancialCronService],
  exports: [FinancialService],
})
export class FinancialModule {}
