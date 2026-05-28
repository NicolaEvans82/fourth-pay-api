import { Module, type Provider } from '@nestjs/common';
import { FourthHcmModule } from '../fourth-hcm.module';
import { PAYROLL_ADAPTER } from './payroll.adapter';
import { MockPayrollAdapter } from './payroll.mock';

// Mock adapter everywhere until Fourth Payroll credentials are wired through.
const payrollAdapterProvider: Provider = {
  provide: PAYROLL_ADAPTER,
  useClass: MockPayrollAdapter,
};

@Module({
  imports: [FourthHcmModule],
  providers: [payrollAdapterProvider],
  exports: [PAYROLL_ADAPTER],
})
export class PayrollModule {}
