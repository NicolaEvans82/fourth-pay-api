import { Inject, Injectable } from '@nestjs/common';
import {
  FOURTH_HCM_CONFIG,
  type FourthHcmConfig,
} from '../fourth-hcm.config';

export const HR_ADAPTER = Symbol('HrAdapter');
export const EMPLOYER_CONFIG_READER = Symbol('EmployerConfigReader');

export interface EmployerPerk {
  name: string;
  description: string;
  value: string; // human-readable e.g. "50% off", "£25/night"
}

export interface EmployerConfig {
  fourthEmployerId: string;
  maxAccessPercent: number;
  // Employer-set ceiling on the % of net earned wages an employee
  // can access early. Default 50 (matches the FCA EWA Code of
  // Practice baseline), configurable up to 70 via the employer
  // dashboard. BalanceService uses this in place of the formerly
  // hard-coded 0.5 multiplier. Note: raising this above 50% is a
  // regulatory decision — the FCA Code of Practice recommends 50%
  // as the ceiling, so deployments using >50% must hold an active
  // FCA permission letter (or be in a sandboxed pilot).
  accessCapPercent: number;
  feeSubsidised: boolean;
  minTenureDays: number;
  enabled: boolean;
  payrollLockdownStartDay: number;
  payrollLockdownEndDay: number;
  perks?: EmployerPerk[];
  // Employer-side pension contribution rate, percent of gross. UK
  // statutory minimum for auto-enrolled employees is 3%. PensionService
  // reads this; production should add a `pension_employer_contribution_percent`
  // column to employer_config (the Pg reader currently returns undefined).
  pensionEmployerContributionPercent?: number;
}

export interface EmployerConfigReader {
  findByFourthEmployerId(
    fourthEmployerId: string,
  ): Promise<EmployerConfig | null>;
}

// Writer is only used by the employer dashboard's "Pay access
// settings" surface. Today's patches are limited to accessCapPercent;
// expand the input type as more knobs surface in the UI. Production
// should back this with an audit_log entry (CLAUDE.md rule 6) so
// regulatory changes to the access cap are traceable.
export const EMPLOYER_CONFIG_WRITER = Symbol('EmployerConfigWriter');
export interface EmployerConfigWriter {
  updateConfig(input: {
    fourthEmployerId: string;
    accessCapPercent?: number;
  }): Promise<EmployerConfig>;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  faid: string;
  paybasis: string;
  employerConfig: EmployerConfig;
}

export interface EmploymentProfile {
  // FAID-derived employment + identity facts the BenefitsService needs.
  // PII rule (CLAUDE.md #4): never include NI number or full bank
  // details here; this object is fine to log if needed.
  dateOfBirth: Date | null;
  employmentStartDate: Date | null;
  isFulltime: boolean;
  rateOfPay: number;
  paybasis: string;
}

export interface HrAdapter {
  checkEligibility(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<EligibilityResult>;
  // Returns the joined Employees + Employments view BenefitsService
  // uses. Throws NotFound semantics by returning null when the FAID
  // is unknown — same contract as fetchEmployee.
  getEmploymentProfile(input: {
    fourthEmployeeId: string;
  }): Promise<EmploymentProfile | null>;
}

interface EmployeesApiRow {
  EmployeeID: number;
  FAID: string;
  PayrollNumber?: string;
  CompanyName?: string;
  Paybasis: string;
  FirstName?: string;
  LastName?: string;
  DateOfBirth?: string;
  NationalInsuranceNumber?: string;
  IR35?: boolean;
}

// Full row shape confirmed by Ali Barlow from the API Explorer.
// `Is*` flags arrive as strings ("Yes" / "No"), not booleans. Dates
// arrive as ISO 8601 strings.
interface EmploymentRecordApiRow {
  EmployeeID: number;
  EmploymentReference: string;
  EmploymentStartDate: string;
  EmploymentEndDate: string;
  AssignmentStartDate: string;
  AssignmentEndDate: string;
  TerminationReason: string;
  Rehire: string;
  EmploymentStatus: string;
  IsPermanent: string;
  IsFulltime: string;
  IsForeignStudent: string;
  IsLiveIn: string;
  EmploymentType: string;
  Department: string;
  DepartmentDescription: string;
  JobCode: string;
  JobDescription: string;
  ShiftType: string;
  SiteCode: string;
  SiteDescription: string;
  RateOfPay: number;
}

@Injectable()
export class FourthHrAdapter implements HrAdapter {
  constructor(
    @Inject(FOURTH_HCM_CONFIG)
    private readonly config: FourthHcmConfig,
    @Inject(EMPLOYER_CONFIG_READER)
    private readonly employerConfigReader: EmployerConfigReader,
  ) {}

  async checkEligibility(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<EligibilityResult> {
    const [employee, employmentRows, employerConfig] = await Promise.all([
      this.fetchEmployee(input.fourthEmployeeId),
      this.fetchEmployment(input.fourthEmployeeId),
      this.loadEmployerConfig(input.fourthEmployerId),
    ]);

    if (!employee) {
      return {
        eligible: false,
        reason: 'Employee not found in Fourth HR',
        faid: input.fourthEmployeeId,
        paybasis: '',
        employerConfig,
      };
    }

    const base = {
      faid: employee.FAID,
      paybasis: employee.Paybasis,
      employerConfig,
    };

    if (!employerConfig.enabled) {
      return { eligible: false, reason: 'EWA not enabled for this employer', ...base };
    }
    if (employee.IR35) {
      return { eligible: false, reason: 'Inside IR35 — not eligible for EWA', ...base };
    }

    const tenure = checkTenure(employmentRows, employerConfig.minTenureDays);
    if (!tenure.passes) {
      return { eligible: false, reason: tenure.reason, ...base };
    }

    return { eligible: true, ...base };
  }

  async getEmploymentProfile(input: {
    fourthEmployeeId: string;
  }): Promise<EmploymentProfile | null> {
    const [employee, employmentRows] = await Promise.all([
      this.fetchEmployee(input.fourthEmployeeId),
      this.fetchEmployment(input.fourthEmployeeId),
    ]);
    if (!employee) return null;
    // Prefer the row whose EmploymentStatus is in the active set
    // (same predicate as the tenure gate); fall back to the first
    // record so we still return something for borderline accounts.
    const active =
      employmentRows.find((e) =>
        ACTIVE_EMPLOYMENT_STATUSES.has(
          (e.EmploymentStatus ?? '').trim().toLowerCase(),
        ),
      ) ?? employmentRows[0];
    return {
      dateOfBirth: employee.DateOfBirth ? new Date(employee.DateOfBirth) : null,
      employmentStartDate: active?.EmploymentStartDate
        ? new Date(active.EmploymentStartDate)
        : null,
      isFulltime: (active?.IsFulltime ?? '').trim().toLowerCase() === 'yes',
      rateOfPay: active?.RateOfPay ?? 0,
      paybasis: employee.Paybasis,
    };
  }

  // Base URL, auth header, AND endpoint paths confirmed by Ali Barlow
  // from the API Explorer (docs/05-integration-contracts.md):
  //   GET /organisations/{orgId}/Employees             — eligibility
  //   GET /organisations/{orgId}/Employees/Employments — employment records
  //
  // Path casing — intentional and matches the confirmed API paths.
  // HR and Payroll endpoints use **lowercase** `/organisations/`, while
  // WFM endpoints use **capital** `/Organisations/`. Do not normalise
  // across adapters without re-checking with Ali — the API Explorer
  // confirmed both forms.
  //
  // NOTE: this.config.baseUrl resolves to 10.12.6.10:85 in production,
  // which is internal to Fourth's network. Outside Fourth infrastructure
  // (e.g. the Railway demo) MockHrAdapter is used instead.

  private async fetchEmployee(faid: string): Promise<EmployeesApiRow | null> {
    const url = new URL(
      `/organisations/${encodeURIComponent(this.config.orgId)}/Employees`,
      this.config.baseUrl,
    );
    url.searchParams.set('FAID', faid);

    const response = await fetch(url, { headers: this.headers() });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(
        `Fourth HCM Get Employees request failed (${response.status})`,
      );
    }
    const rows = (await response.json()) as EmployeesApiRow[];
    return rows.find((r) => r.FAID === faid) ?? null;
  }

  private async fetchEmployment(
    faid: string,
  ): Promise<EmploymentRecordApiRow[]> {
    const url = new URL(
      `/organisations/${encodeURIComponent(this.config.orgId)}/Employees/Employments`,
      this.config.baseUrl,
    );
    url.searchParams.set('FAID', faid);

    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      throw new Error(
        `Fourth HCM Employment Records request failed (${response.status})`,
      );
    }
    return (await response.json()) as EmploymentRecordApiRow[];
  }

  private async loadEmployerConfig(
    fourthEmployerId: string,
  ): Promise<EmployerConfig> {
    const config = await this.employerConfigReader.findByFourthEmployerId(
      fourthEmployerId,
    );
    if (!config) {
      throw new Error(
        `No employer_config row for ${fourthEmployerId} — employer onboarding incomplete`,
      );
    }
    return config;
  }

  // Confirmed by Ali Barlow on 2026-05-28: single X-Fourth-Org header
  // carrying the OrganisationID / GroupID. No separate token.
  private headers(): Record<string, string> {
    return {
      'X-Fourth-Org': this.config.orgId,
      Accept: 'application/json',
    };
  }
}

// Permitted EmploymentStatus values that count as currently-employed.
// Confirmed values from the API Explorer aren't enumerated, so this is
// a best-guess match list — if production ever sees a different
// in-employment value (e.g. "OnLeave"), extend this set rather than
// loosening the check.
const ACTIVE_EMPLOYMENT_STATUSES = new Set([
  'active',
  'current',
  'employed',
  'live',
]);

function checkTenure(
  employment: EmploymentRecordApiRow[],
  minTenureDays: number,
): { passes: true } | { passes: false; reason: string } {
  // Use EmploymentStatus as the primary signal — Ali confirmed the
  // field is present on every row. Date-based "no EndDate = active"
  // is no longer needed.
  const active = employment.find((e) =>
    ACTIVE_EMPLOYMENT_STATUSES.has((e.EmploymentStatus ?? '').trim().toLowerCase()),
  );
  if (!active) {
    return { passes: false, reason: 'No active employment record' };
  }
  if (active.EmploymentStartDate) {
    const start = new Date(active.EmploymentStartDate);
    const days = Math.floor(
      (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days < minTenureDays) {
      return {
        passes: false,
        reason: `Below minimum tenure (${days}/${minTenureDays} days)`,
      };
    }
  }
  return { passes: true };
}
