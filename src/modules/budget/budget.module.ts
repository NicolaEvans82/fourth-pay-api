import { Module } from '@nestjs/common';
import {
  EMPLOYEE_ACCOUNT_READER,
  MockEmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import { EwaModule } from '../ewa/ewa.module';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';

// EwaModule exports BalanceService + EWA_TRANSFER_READER; we just
// re-use them to derive the budget. No new tables, no business logic
// duplicated.
@Module({
  imports: [EwaModule],
  controllers: [BudgetController],
  providers: [
    BudgetService,
    { provide: EMPLOYEE_ACCOUNT_READER, useClass: MockEmployeeAccountReader },
  ],
})
export class BudgetModule {}
