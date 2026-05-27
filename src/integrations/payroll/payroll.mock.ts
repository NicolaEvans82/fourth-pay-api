import { Injectable } from '@nestjs/common';
import { JORDAN_HARRIS_FAID } from '../wfm/wfm.mock';
import { PayPeriodConfig, PayrollAdapter } from './payroll.adapter';

// May 2026 period for Jordan Harris. averageDeductionRate ≈ 20% — plausible
// for a UK low-earner: basic-rate income tax + NI + light pension contribution.
const JORDAN_PAY_PERIOD: PayPeriodConfig = {
  periodStart: new Date('2026-05-01T00:00:00Z'),
  periodEnd: new Date('2026-05-31T23:59:59Z'),
  nextPayday: new Date('2026-05-31T00:00:00Z'),
  averageDeductionRate: 0.2,
};

@Injectable()
export class MockPayrollAdapter implements PayrollAdapter {
  async getPayPeriodConfig(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<PayPeriodConfig> {
    if (input.fourthEmployeeId !== JORDAN_HARRIS_FAID) {
      throw new Error(
        `No payroll record for ${input.fourthEmployeeId}`,
      );
    }
    return JORDAN_PAY_PERIOD;
  }
}
