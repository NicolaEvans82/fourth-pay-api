import { Injectable } from '@nestjs/common';
import { JORDAN_HARRIS_FAID } from '../wfm/wfm.mock';
import {
  PayPeriodConfig,
  PayrollAdapter,
  PayslipDetail,
  PayslipSummary,
} from './payroll.adapter';

// May 2026 period for Jordan Harris. averageDeductionRate ≈ 20% — plausible
// for a UK low-earner: basic-rate income tax + NI + light pension contribution.
const JORDAN_PAY_PERIOD: PayPeriodConfig = {
  periodStart: new Date('2026-05-01T00:00:00Z'),
  periodEnd: new Date('2026-05-31T23:59:59Z'),
  nextPayday: new Date('2026-05-31T00:00:00Z'),
  averageDeductionRate: 0.2,
};

// Historical payslips for Jordan — both fall in UK tax year 2025/26
// (6 Apr 2025 – 5 Apr 2026), so YTD-as-of-March sums both.
const JORDAN_PAYSLIPS: PayslipDetail[] = [
  {
    payPeriodStart: new Date('2026-02-01T00:00:00Z'),
    paymentDate: new Date('2026-02-28T00:00:00Z'),
    grossPay: 1500,
    totalDeductions: 300,
    netPay: 1200,
    elements: [
      {
        elementName: 'Basic Hours',
        units: 100,
        rate: 12.5,
        value: 1250,
        isDeduction: false,
      },
      {
        elementName: 'Overtime',
        units: 20,
        rate: 12.5,
        value: 250,
        isDeduction: false,
      },
      {
        elementName: 'Income Tax',
        units: null,
        rate: null,
        value: -200,
        isDeduction: true,
      },
      {
        elementName: 'National Insurance',
        units: null,
        rate: null,
        value: -100,
        isDeduction: true,
      },
    ],
  },
  {
    payPeriodStart: new Date('2026-03-01T00:00:00Z'),
    paymentDate: new Date('2026-03-31T00:00:00Z'),
    grossPay: 1600,
    totalDeductions: 380,
    netPay: 1220,
    elements: [
      {
        elementName: 'Basic Hours',
        units: 110,
        rate: 12.5,
        value: 1375,
        isDeduction: false,
      },
      {
        elementName: 'Overtime',
        units: 18,
        rate: 12.5,
        value: 225,
        isDeduction: false,
      },
      {
        elementName: 'Income Tax',
        units: null,
        rate: null,
        value: -220,
        isDeduction: true,
      },
      {
        elementName: 'National Insurance',
        units: null,
        rate: null,
        value: -110,
        isDeduction: true,
      },
      {
        elementName: 'EWA Advance',
        units: null,
        rate: null,
        value: -50,
        isDeduction: true,
      },
    ],
  },
];

@Injectable()
export class MockPayrollAdapter implements PayrollAdapter {
  async getPayPeriodConfig(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<PayPeriodConfig> {
    if (input.fourthEmployeeId !== JORDAN_HARRIS_FAID) {
      throw new Error(`No payroll record for ${input.fourthEmployeeId}`);
    }
    return JORDAN_PAY_PERIOD;
  }

  async listPayslips(input: {
    fourthEmployeeId: string;
  }): Promise<PayslipSummary[]> {
    if (input.fourthEmployeeId !== JORDAN_HARRIS_FAID) return [];
    return JORDAN_PAYSLIPS.map((p) => ({
      payPeriodStart: p.payPeriodStart,
      paymentDate: p.paymentDate,
      grossPay: p.grossPay,
      netPay: p.netPay,
    })).sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());
  }

  async getPayslip(input: {
    fourthEmployeeId: string;
    payPeriodStart: Date;
  }): Promise<PayslipDetail | null> {
    if (input.fourthEmployeeId !== JORDAN_HARRIS_FAID) return null;
    return (
      JORDAN_PAYSLIPS.find(
        (p) =>
          p.payPeriodStart.toISOString() === input.payPeriodStart.toISOString(),
      ) ?? null
    );
  }
}
