import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  HR_ADAPTER,
  type HrAdapter,
} from '../../integrations/hr/hr.adapter';
import {
  PAYROLL_ADAPTER,
  type PayrollAdapter,
} from '../../integrations/payroll/payroll.adapter';

const RETIREMENT_AGE = 67;
const DEFAULT_YEARS_TO_RETIREMENT = 30;
const TENURE_DAYS_FOR_LOST_PENSION_NUDGE = 2 * 365;
const PENSION_AUTO_ENROL_MIN_AGE = 22;
const PENSION_AUTO_ENROL_EARNINGS_THRESHOLD_GBP_ANNUAL = 10_000;
const ASSUMED_FULLTIME_HOURS_PER_WEEK = 37.5;
const ASSUMED_PARTTIME_HOURS_PER_WEEK = 16;
const GOVERNMENT_TRACING_URL = 'https://www.gov.uk/find-pension-contact-details';

export type AutoEnrolmentStatus =
  | 'eligible'
  | 'enrolled'
  | 'opted_out'
  | 'below_threshold';

export interface IncreaseScenario {
  // The hypothetical new total employee contribution percent.
  newEmployeePercent: number;
  // Extra monthly cost vs the current contribution (£).
  extraMonthlyCost: number;
  // What the pot grows to under this scenario (£).
  projectedPot: number;
  // Difference vs the baseline projection (£).
  potUplift: number;
}

export interface PensionResponse {
  currentContributionPercent: number;
  employerContributionPercent: number;
  totalMonthlyContribution: number;
  projectedPot: number;
  autoEnrolmentStatus: AutoEnrolmentStatus;
  increaseScenarios: IncreaseScenario[];
  lostPensionNudge: boolean;
  governmentTracingUrl: string;
  // Surfaced so the UI can show how the projection was anchored
  // without recomputing.
  detail: {
    referenceGrossPay: number;
    yearsToRetirement: number;
    estimatedAge: number | null;
  };
}

@Injectable()
export class PensionService {
  constructor(
    @Inject(HR_ADAPTER) private readonly hr: HrAdapter,
    @Inject(PAYROLL_ADAPTER) private readonly payroll: PayrollAdapter,
  ) {}

  async getPension(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<PensionResponse> {
    const eligibility = await this.hr.checkEligibility(input);
    const profile = await this.hr.getEmploymentProfile(input);
    if (!profile) {
      throw new NotFoundException(
        'Employee not enrolled — cannot compute pension',
      );
    }
    const employerPercent =
      eligibility.employerConfig.pensionEmployerContributionPercent ?? 0;

    const [payslips, deductions] = await Promise.all([
      this.payroll.listPayslips(input).catch(() => []),
      this.payroll.getDeductions(input).catch(() => []),
    ]);

    // Reference gross pay = the most recent payslip's gross. If no
    // payslip is on file (e.g. brand-new employee like Marcus),
    // estimate from rate × assumed weekly hours × 4.33.
    const referenceGrossPay = pickReferenceGrossPay(payslips, profile);

    // Current employee % = (latest pension deduction / reference gross) * 100,
    // or 0 if no pension deduction is present.
    const latestPensionDeduction = pickLatestPensionDeduction(deductions);
    const currentEmployeePercent =
      latestPensionDeduction !== null && referenceGrossPay > 0
        ? round2((latestPensionDeduction / referenceGrossPay) * 100)
        : 0;

    // Auto-enrol status — reuses the same thresholds the benefits
    // checker exposes.
    const weeklyHours = profile.isFulltime
      ? ASSUMED_FULLTIME_HOURS_PER_WEEK
      : ASSUMED_PARTTIME_HOURS_PER_WEEK;
    const annualEarningsEstimate = round2(
      profile.rateOfPay * weeklyHours * 52,
    );
    const age = profile.dateOfBirth ? yearsBetween(profile.dateOfBirth, new Date()) : null;
    const meetsAge = age !== null && age >= PENSION_AUTO_ENROL_MIN_AGE;
    const meetsEarnings =
      annualEarningsEstimate >= PENSION_AUTO_ENROL_EARNINGS_THRESHOLD_GBP_ANNUAL;
    let autoEnrolmentStatus: AutoEnrolmentStatus;
    if (latestPensionDeduction !== null && latestPensionDeduction > 0) {
      autoEnrolmentStatus = 'enrolled';
    } else if (!meetsAge || !meetsEarnings) {
      autoEnrolmentStatus = 'below_threshold';
    } else {
      // Meets thresholds but no deduction on record — eligible but
      // not yet contributing. 'opted_out' would require a signal we
      // don't have (no opt-out flag in the mock); production with
      // the real Pensions Regulator feed could distinguish.
      autoEnrolmentStatus = 'eligible';
    }

    // Current total monthly contribution. The employer match only
    // applies when the employee is actually enrolled — for
    // below_threshold / opted_out / eligible-but-not-yet-contributing
    // employees, the employer isn't contributing either, so the
    // current total should reflect £0.
    const effectiveEmployerPercent =
      autoEnrolmentStatus === 'enrolled' ? employerPercent : 0;
    const totalPercent = currentEmployeePercent + effectiveEmployerPercent;
    const totalMonthlyContribution = round2(
      referenceGrossPay * (totalPercent / 100),
    );

    // Projection — simple flat-rate accumulation (no growth, no
    // inflation, no salary increases). Comment lives on the
    // controller's docs so consumers know.
    const yearsToRetirement =
      age !== null
        ? Math.max(0, RETIREMENT_AGE - age)
        : DEFAULT_YEARS_TO_RETIREMENT;
    const projectedPot = round2(
      totalMonthlyContribution * 12 * yearsToRetirement,
    );

    // Three scenarios: +1%, +2%, +3% on top of the current employee %.
    const increaseScenarios: IncreaseScenario[] = [1, 2, 3].map((delta) => {
      const newEmployeePercent = round2(currentEmployeePercent + delta);
      const newTotalPercent = newEmployeePercent + employerPercent;
      const newMonthlyContribution = round2(
        referenceGrossPay * (newTotalPercent / 100),
      );
      const newProjectedPot = round2(
        newMonthlyContribution * 12 * yearsToRetirement,
      );
      const extraMonthlyCost = round2(
        referenceGrossPay * (delta / 100),
      );
      return {
        newEmployeePercent,
        extraMonthlyCost,
        projectedPot: newProjectedPot,
        potUplift: round2(newProjectedPot - projectedPot),
      };
    });

    // Lost-pension nudge — fires if current tenure suggests the
    // employee has likely worked elsewhere before.
    const tenureDays = profile.employmentStartDate
      ? Math.floor(
          (Date.now() - profile.employmentStartDate.getTime()) / 86400000,
        )
      : 0;
    const lostPensionNudge = tenureDays > TENURE_DAYS_FOR_LOST_PENSION_NUDGE;

    return {
      currentContributionPercent: currentEmployeePercent,
      employerContributionPercent: employerPercent,
      totalMonthlyContribution,
      projectedPot,
      autoEnrolmentStatus,
      increaseScenarios,
      lostPensionNudge,
      governmentTracingUrl: GOVERNMENT_TRACING_URL,
      detail: {
        referenceGrossPay,
        yearsToRetirement,
        estimatedAge: age,
      },
    };
  }
}

function pickReferenceGrossPay(
  payslips: Array<{ paymentDate: Date; grossPay: number }>,
  profile: { rateOfPay: number; isFulltime: boolean },
): number {
  if (payslips.length > 0) {
    const sorted = [...payslips].sort(
      (a, b) => b.paymentDate.getTime() - a.paymentDate.getTime(),
    );
    return round2(sorted[0].grossPay);
  }
  const weeklyHours = profile.isFulltime
    ? ASSUMED_FULLTIME_HOURS_PER_WEEK
    : ASSUMED_PARTTIME_HOURS_PER_WEEK;
  // 4.33 weeks per month — same approximation BalanceService uses.
  return round2(profile.rateOfPay * weeklyHours * 4.33);
}

function pickLatestPensionDeduction(
  deductions: Array<{
    elementName: string;
    amount: number;
    payPeriodStart: Date;
  }>,
): number | null {
  const pensionRows = deductions
    .filter((d) => d.elementName.toLowerCase().includes('pension'))
    .sort((a, b) => b.payPeriodStart.getTime() - a.payPeriodStart.getTime());
  return pensionRows[0]?.amount ?? null;
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
