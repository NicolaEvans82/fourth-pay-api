import { Module, type Provider } from '@nestjs/common';
import { FourthHcmModule } from '../fourth-hcm.module';
import { FourthPayrollAdapter, PAYROLL_ADAPTER } from './payroll.adapter';
import { MockPayrollAdapter } from './payroll.mock';

const payrollAdapterProvider: Provider = {
  provide: PAYROLL_ADAPTER,
  useClass:
    process.env.NODE_ENV === 'production'
      ? FourthPayrollAdapter
      : MockPayrollAdapter,
};

@Module({
  imports: [FourthHcmModule],
  providers: [payrollAdapterProvider],
  exports: [PAYROLL_ADAPTER],
})
export class PayrollModule {}
