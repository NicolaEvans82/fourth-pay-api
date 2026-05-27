import { Inject, Injectable } from '@nestjs/common';
import {
  FOURTH_HCM_CONFIG,
  type FourthHcmConfig,
} from '../fourth-hcm.config';

export const PAYROLL_ADAPTER = Symbol('PayrollAdapter');

export interface PayPeriodConfig {
  periodStart: Date;
  periodEnd: Date;
  nextPayday: Date;
  averageDeductionRate: number;
}

export interface PayrollAdapter {
  getPayPeriodConfig(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<PayPeriodConfig>;
}

interface PayrollPeriodApiRow {
  CompanyName?: string;
  PeriodName?: string;
  PeriodNumber?: number;
  PeriodTaxYear?: number;
  PayDate: string;
  PeriodStartDate: string;
  PeriodEndDate: string;
}

interface PayslipApiRow {
  PayslipDate: string;
  PaymentDate?: string;
  ElementName: string;
  Units?: number;
  Rate?: number;
  Value: number;
  Department?: string;
  JobDescription?: string;
  SiteDescription?: string;
}

const DEDUCTION_RATE_PERIODS = 3;

@Injectable()
export class FourthPayrollAdapter implements PayrollAdapter {
  constructor(
    @Inject(FOURTH_HCM_CONFIG)
    private readonly config: FourthHcmConfig,
  ) {}

  async getPayPeriodConfig(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<PayPeriodConfig> {
    const [period, payslips] = await Promise.all([
      this.fetchCurrentPeriod(input.fourthEmployeeId),
      this.fetchRecentPayslips(input.fourthEmployeeId),
    ]);

    if (!period) {
      throw new Error(
        `No current payroll period for ${input.fourthEmployeeId}`,
      );
    }

    return {
      periodStart: new Date(period.PeriodStartDate),
      periodEnd: new Date(period.PeriodEndDate),
      nextPayday: new Date(period.PayDate),
      averageDeductionRate: computeAverageDeductionRate(payslips),
    };
  }

  private async fetchCurrentPeriod(
    faid: string,
  ): Promise<PayrollPeriodApiRow | null> {
    // TODO: confirm endpoint path and query-param names with Ali Barlow.
    const url = new URL('/peoplesystem/payrollperiods', this.config.baseUrl);
    url.searchParams.set('FAID', faid);

    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      throw new Error(
        `Fourth HCM Payroll Periods request failed (${response.status})`,
      );
    }
    const rows = (await response.json()) as PayrollPeriodApiRow[];
    const now = Date.now();
    return (
      rows.find((r) => {
        const start = Date.parse(r.PeriodStartDate);
        const end = Date.parse(r.PeriodEndDate);
        return start <= now && now <= end;
      }) ?? null
    );
  }

  private async fetchRecentPayslips(
    faid: string,
  ): Promise<PayslipApiRow[]> {
    // TODO: confirm endpoint path and query-param names with Ali Barlow.
    const url = new URL('/peoplesystem/payslips', this.config.baseUrl);
    url.searchParams.set('FAID', faid);

    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      throw new Error(
        `Fourth HCM Payslips request failed (${response.status})`,
      );
    }
    return (await response.json()) as PayslipApiRow[];
  }

  private headers(): Record<string, string> {
    return {
      'X-Fourth-Org-Token': this.config.orgToken,
      'X-Fourth-Org-Id': this.config.orgId,
      Accept: 'application/json',
    };
  }
}

// Deduction elements appear as negative-Value rows per docs/05-integration-contracts.md.
// Rate = sum(|negative values|) / sum(positive values), averaged across the last N payslips.
function computeAverageDeductionRate(rows: PayslipApiRow[]): number {
  const byDate = new Map<string, PayslipApiRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.PayslipDate) ?? [];
    list.push(row);
    byDate.set(row.PayslipDate, list);
  }
  const recentPeriods = Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, DEDUCTION_RATE_PERIODS)
    .map(([, items]) => items);

  if (recentPeriods.length === 0) return 0;

  const rates = recentPeriods.map((items) => {
    let earnings = 0;
    let deductions = 0;
    for (const item of items) {
      if (item.Value > 0) earnings += item.Value;
      else if (item.Value < 0) deductions += -item.Value;
    }
    return earnings === 0 ? 0 : deductions / earnings;
  });
  return rates.reduce((sum, r) => sum + r, 0) / rates.length;
}
