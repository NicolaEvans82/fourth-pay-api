import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  HR_ADAPTER,
  type EmploymentProfile,
  type HrAdapter,
} from '../../integrations/hr/hr.adapter';
import {
  PAYROLL_ADAPTER,
  type PayrollAdapter,
} from '../../integrations/payroll/payroll.adapter';

// All numbers below are the 2025/26 statutory rates as published by
// gov.uk (rates effective April 2025). Update when April 2026 rates
// are confirmed. Centralised here so a single edit covers the whole
// service.
const SSP_LOWER_EARNINGS_LIMIT_GBP_WEEKLY = 123;
const PENSION_AUTO_ENROL_MIN_AGE = 22;
const PENSION_AUTO_ENROL_EARNINGS_THRESHOLD_GBP_ANNUAL = 10_000;
const MATERNITY_QUALIFYING_WEEKS = 26;
const STATUTORY_HOLIDAY_WEEKS = 5.6;
const ASSUMED_FULLTIME_HOURS_PER_WEEK = 37.5;
const ASSUMED_PARTTIME_HOURS_PER_WEEK = 16;

const NMW_RATES: Array<{ minAge: number; rate: number; label: string }> = [
  { minAge: 21, rate: 12.21, label: '21 and over' },
  { minAge: 18, rate: 10.0, label: '18 to 20' },
  { minAge: 0, rate: 7.55, label: 'Under 18 / apprentice' },
];

export interface BenefitsResponse {
  holiday: {
    eligible: boolean;
    annualDays: number;
    accruedDays: number;
    detail: string;
  };
  sickPay: {
    eligible: boolean;
    weeklyEarningsEstimate: number;
    lowerEarningsLimit: number;
    detail: string;
  };
  pension: {
    autoEnrolEligible: boolean;
    currentContribution: number | null;
    annualEarningsEstimate: number;
    detail: string;
  };
  nmwCompliance: {
    compliant: boolean;
    bracketLabel: string;
    bracketRate: number;
    yourRate: number;
    detail: string;
  };
  maternityPaternity: {
    eligible: boolean;
    daysOfTenure: number;
    detail: string;
  };
}

@Injectable()
export class BenefitsService {
  constructor(
    @Inject(HR_ADAPTER) private readonly hr: HrAdapter,
    @Inject(PAYROLL_ADAPTER) private readonly payroll: PayrollAdapter,
  ) {}

  async getBenefits(input: {
    fourthEmployeeId: string;
  }): Promise<BenefitsResponse> {
    const profile = await this.hr.getEmploymentProfile(input);
    if (!profile) {
      throw new NotFoundException(
        'Employee not enrolled — cannot compute benefits',
      );
    }
    const deductions = await this.payroll
      .getDeductions(input)
      .catch(() => []); // tolerate missing deductions data

    const weeklyHours = profile.isFulltime
      ? ASSUMED_FULLTIME_HOURS_PER_WEEK
      : ASSUMED_PARTTIME_HOURS_PER_WEEK;
    const weeklyEarnings = round2(profile.rateOfPay * weeklyHours);
    const annualEarnings = round2(weeklyEarnings * 52);
    const ageYears = profile.dateOfBirth ? yearsBetween(profile.dateOfBirth, new Date()) : null;
    const tenureDays = profile.employmentStartDate
      ? daysBetween(profile.employmentStartDate, new Date())
      : 0;

    return {
      holiday: calcHoliday(profile.isFulltime, tenureDays),
      sickPay: calcSickPay(weeklyEarnings),
      pension: calcPension(ageYears, annualEarnings, deductions),
      nmwCompliance: calcNmw(ageYears, profile.rateOfPay),
      maternityPaternity: calcMaternityPaternity(tenureDays),
    };
  }
}

function calcHoliday(
  isFulltime: boolean,
  tenureDays: number,
): BenefitsResponse['holiday'] {
  // Statutory 5.6 weeks (28 days) for a 5-day-week worker, pro-rated
  // for part-time. The 16-day figure approximates 5.6 × ~3 days/week
  // — production should use the employee's actual contractual days
  // per week from the EmploymentRecord.
  const annualDays = isFulltime
    ? Math.round(STATUTORY_HOLIDAY_WEEKS * 5)
    : 16;
  const accruedDays = Math.min(
    annualDays,
    Math.round((tenureDays / 365) * annualDays),
  );
  return {
    eligible: true,
    annualDays,
    accruedDays,
    detail: `${annualDays} days/year statutory entitlement · ${accruedDays} days accrued so far`,
  };
}

function calcSickPay(weeklyEarnings: number): BenefitsResponse['sickPay'] {
  const eligible = weeklyEarnings >= SSP_LOWER_EARNINGS_LIMIT_GBP_WEEKLY;
  return {
    eligible,
    weeklyEarningsEstimate: weeklyEarnings,
    lowerEarningsLimit: SSP_LOWER_EARNINGS_LIMIT_GBP_WEEKLY,
    detail: eligible
      ? `Estimated £${weeklyEarnings}/week ≥ £${SSP_LOWER_EARNINGS_LIMIT_GBP_WEEKLY} Lower Earnings Limit`
      : `Estimated £${weeklyEarnings}/week is below the £${SSP_LOWER_EARNINGS_LIMIT_GBP_WEEKLY} Lower Earnings Limit — not currently eligible`,
  };
}

function calcPension(
  age: number | null,
  annualEarnings: number,
  deductions: Array<{ elementName: string; amount: number }>,
): BenefitsResponse['pension'] {
  const ageEligible = age !== null && age >= PENSION_AUTO_ENROL_MIN_AGE;
  const earningsEligible =
    annualEarnings >= PENSION_AUTO_ENROL_EARNINGS_THRESHOLD_GBP_ANNUAL;
  const autoEnrolEligible = ageEligible && earningsEligible;

  // Pull current pension contribution from deduction rows whose
  // element name mentions pension. Case-insensitive substring match
  // covers "Pension", "Workplace Pension", "Employee Pension".
  const pensionDeduction = deductions.find((d) =>
    d.elementName.toLowerCase().includes('pension'),
  );
  const currentContribution = pensionDeduction
    ? round2(pensionDeduction.amount)
    : null;

  let detail: string;
  if (!ageEligible) {
    detail = `Auto-enrolment age is ${PENSION_AUTO_ENROL_MIN_AGE} — you'll qualify when you reach it`;
  } else if (!earningsEligible) {
    detail = `Estimated annual earnings £${Math.round(annualEarnings)} below the £${PENSION_AUTO_ENROL_EARNINGS_THRESHOLD_GBP_ANNUAL.toLocaleString('en-GB')} auto-enrolment threshold — you can still opt in voluntarily`;
  } else {
    detail = `Eligible for auto-enrolment${currentContribution !== null ? ` · current contribution £${currentContribution}/pay period` : ' · no current contribution recorded'}`;
  }

  return {
    autoEnrolEligible,
    currentContribution,
    annualEarningsEstimate: annualEarnings,
    detail,
  };
}

function calcNmw(
  age: number | null,
  rateOfPay: number,
): BenefitsResponse['nmwCompliance'] {
  // First bracket whose minAge ≤ the employee's age wins. Default to
  // the lowest bracket if age is unknown (most generous to the worker
  // for the compliance check — keep them safe).
  const bracket =
    NMW_RATES.find((b) => age !== null && age >= b.minAge) ??
    NMW_RATES[NMW_RATES.length - 1];
  const compliant = rateOfPay >= bracket.rate;
  return {
    compliant,
    bracketLabel: bracket.label,
    bracketRate: bracket.rate,
    yourRate: round2(rateOfPay),
    detail: compliant
      ? `£${round2(rateOfPay)}/hr meets the £${bracket.rate}/hr ${bracket.label} minimum`
      : `£${round2(rateOfPay)}/hr is below the £${bracket.rate}/hr ${bracket.label} minimum — your employer may owe back-pay`,
  };
}

function calcMaternityPaternity(
  tenureDays: number,
): BenefitsResponse['maternityPaternity'] {
  const eligible = tenureDays >= MATERNITY_QUALIFYING_WEEKS * 7;
  const weeks = Math.floor(tenureDays / 7);
  return {
    eligible,
    daysOfTenure: tenureDays,
    detail: eligible
      ? `${weeks} weeks of tenure — past the ${MATERNITY_QUALIFYING_WEEKS}-week qualifying period`
      : `${weeks} weeks of tenure — you'll qualify after ${MATERNITY_QUALIFYING_WEEKS} weeks (${MATERNITY_QUALIFYING_WEEKS - weeks} more to go)`,
  };
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function yearsBetween(birth: Date, now: Date): number {
  let years = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) years--;
  return years;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
