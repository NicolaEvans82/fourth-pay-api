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

export interface PayslipElement {
  elementName: string;
  units: number | null;
  rate: number | null;
  value: number;
  isDeduction: boolean;
}

export interface PayslipSummary {
  payPeriodStart: Date;
  paymentDate: Date;
  grossPay: number;
  netPay: number;
}

export interface PayslipDetail extends PayslipSummary {
  totalDeductions: number;
  elements: PayslipElement[];
}

export interface DeductionRecord {
  elementName: string;
  amount: number;
  payPeriodStart: Date;
}

export interface PayrollAdapter {
  getPayPeriodConfig(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<PayPeriodConfig>;
  listPayslips(input: {
    fourthEmployeeId: string;
  }): Promise<PayslipSummary[]>;
  getPayslip(input: {
    fourthEmployeeId: string;
    payPeriodStart: Date;
  }): Promise<PayslipDetail | null>;
  // Standalone deductions feed — Ali Barlow confirmed the URL on the
  // API Explorer. Used to compute the `average_deduction_rate` net-pay
  // factor that drives the balance formula. Currently the same number
  // is also derivable from negative-Value payslip rows; once the
  // production adapter is wired in, prefer this endpoint.
  getDeductions(input: {
    fourthEmployeeId: string;
  }): Promise<DeductionRecord[]>;
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

interface DeductionApiRow {
  ElementName: string;
  Value: number;
  PeriodStartDate: string;
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
      this.fetchPayslipRows(input.fourthEmployeeId),
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

  async listPayslips(input: {
    fourthEmployeeId: string;
  }): Promise<PayslipSummary[]> {
    const rows = await this.fetchPayslipRows(input.fourthEmployeeId);
    const grouped = groupByPayslipDate(rows);
    return Array.from(grouped.entries())
      .map(([date, items]) => buildSummary(date, items))
      .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());
  }

  async getPayslip(input: {
    fourthEmployeeId: string;
    payPeriodStart: Date;
  }): Promise<PayslipDetail | null> {
    // TODO: real period-start matching needs a join with Payroll Periods to map
    // PeriodStartDate ↔ PayslipDate. For now we treat the request's
    // payPeriodStart as the PayslipDate prefix.
    const rows = await this.fetchPayslipRows(input.fourthEmployeeId);
    const target = input.payPeriodStart.toISOString().slice(0, 10);
    const items = rows.filter((r) => r.PayslipDate.startsWith(target));
    if (items.length === 0) return null;
    return buildDetail(target, items);
  }

  async getDeductions(input: {
    fourthEmployeeId: string;
  }): Promise<DeductionRecord[]> {
    // Confirmed by Ali Barlow from the API Explorer:
    //   GET /organisations/{orgId}/Employees/Deductions
    const url = new URL(
      `/organisations/${encodeURIComponent(this.config.orgId)}/Employees/Deductions`,
      this.config.baseUrl,
    );
    url.searchParams.set('FAID', input.fourthEmployeeId);

    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      throw new Error(
        `Fourth HCM Deductions request failed (${response.status})`,
      );
    }
    const rows = (await response.json()) as DeductionApiRow[];
    return rows.map((r) => ({
      elementName: r.ElementName,
      // Deductions arrive as positive amounts on this endpoint
      // (unlike payslip rows where deductions are negative Values).
      amount: r.Value,
      payPeriodStart: new Date(r.PeriodStartDate),
    }));
  }

  private async fetchCurrentPeriod(
    faid: string,
  ): Promise<PayrollPeriodApiRow | null> {
    // Confirmed by Ali Barlow from the API Explorer:
    //   GET /organisations/{orgId}/PayrollPeriod
    // Singular `PayrollPeriod`, not `PayrollPeriods` — the prior
    // placeholder guessed the plural.
    const url = new URL(
      `/organisations/${encodeURIComponent(this.config.orgId)}/PayrollPeriod`,
      this.config.baseUrl,
    );
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

  private async fetchPayslipRows(faid: string): Promise<PayslipApiRow[]> {
    // Confirmed by Ali Barlow from the API Explorer:
    //   GET /organisations/{orgId}/Payslips
    const url = new URL(
      `/organisations/${encodeURIComponent(this.config.orgId)}/Payslips`,
      this.config.baseUrl,
    );
    url.searchParams.set('FAID', faid);

    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      throw new Error(
        `Fourth HCM Payslips request failed (${response.status})`,
      );
    }
    return (await response.json()) as PayslipApiRow[];
  }

  // Confirmed by Ali Barlow on 2026-05-28: single X-Fourth-Org header
  // carrying the OrganisationID / GroupID. No separate token.
  // The base URL (this.config.baseUrl → 10.12.6.10:85) is internal to
  // Fourth's network; MockPayrollAdapter is used outside Fourth.
  private headers(): Record<string, string> {
    return {
      'X-Fourth-Org': this.config.orgId,
      Accept: 'application/json',
    };
  }
}

function groupByPayslipDate(
  rows: PayslipApiRow[],
): Map<string, PayslipApiRow[]> {
  const grouped = new Map<string, PayslipApiRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.PayslipDate) ?? [];
    list.push(row);
    grouped.set(row.PayslipDate, list);
  }
  return grouped;
}

function buildSummary(date: string, items: PayslipApiRow[]): PayslipSummary {
  const grossPay = items
    .filter((r) => r.Value > 0)
    .reduce((s, r) => s + r.Value, 0);
  const totalDeductions = -items
    .filter((r) => r.Value < 0)
    .reduce((s, r) => s + r.Value, 0);
  const paymentDate = items[0]?.PaymentDate
    ? new Date(items[0].PaymentDate)
    : new Date(date);
  return {
    payPeriodStart: new Date(date),
    paymentDate,
    grossPay: round2(grossPay),
    netPay: round2(grossPay - totalDeductions),
  };
}

function buildDetail(date: string, items: PayslipApiRow[]): PayslipDetail {
  const summary = buildSummary(date, items);
  return {
    ...summary,
    totalDeductions: round2(summary.grossPay - summary.netPay),
    elements: items.map((r) => ({
      elementName: r.ElementName,
      units: r.Units ?? null,
      rate: r.Rate ?? null,
      value: r.Value,
      isDeduction: r.Value < 0,
    })),
  };
}

// Deduction elements appear as negative-Value rows per docs/05-integration-contracts.md.
// Rate = sum(|negative values|) / sum(positive values), averaged across the last N payslips.
function computeAverageDeductionRate(rows: PayslipApiRow[]): number {
  const recentPeriods = Array.from(groupByPayslipDate(rows).entries())
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
