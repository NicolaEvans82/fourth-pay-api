import { Module } from '@nestjs/common';
import { PayrollModule } from '../../integrations/payroll/payroll.module';
import { EwaModule } from '../ewa/ewa.module';
import { SavingsModule } from '../savings/savings.module';
import { SpendingController } from './spending.controller';
import { SpendingService } from './spending.service';

// SpendingService depends on:
// - BalanceService (from EwaModule, already exported there)
// - SavingsService (from SavingsModule, already exported there)
// - PAYROLL_ADAPTER token (provided by PayrollModule, which is @Global)
@Module({
  imports: [EwaModule, SavingsModule, PayrollModule],
  controllers: [SpendingController],
  providers: [SpendingService],
})
export class SpendingModule {}
