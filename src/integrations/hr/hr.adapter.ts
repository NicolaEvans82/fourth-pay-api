import { Inject, Injectable } from '@nestjs/common';
import {
  FOURTH_HCM_CONFIG,
  type FourthHcmConfig,
} from '../fourth-hcm.config';

export const HR_ADAPTER = Symbol('HrAdapter');
export const EMPLOYER_CONFIG_READER = Symbol('EmployerConfigReader');

export interface EmployerConfig {
  fourthEmployerId: string;
  maxAccessPercent: number;
  feeSubsidised: boolean;
  minTenureDays: number;
  enabled: boolean;
  payrollLockdownStartDay: number;
  payrollLockdownEndDay: number;
}

export interface EmployerConfigReader {
  findByFourthEmployerId(
    fourthEmployerId: string,
  ): Promise<EmployerConfig | null>;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  faid: string;
  paybasis: string;
  employerConfig: EmployerConfig;
}

export interface HrAdapter {
  checkEligibility(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<EligibilityResult>;
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

interface EmploymentRecordApiRow {
  StartDate?: string;
  EndDate?: string | null;
  ContractType?: string;
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

  private async fetchEmployee(faid: string): Promise<EmployeesApiRow | null> {
    // TODO: confirm path and query-param names with Ali Barlow (deployment-config gap).
    const url = new URL('/peoplesystem/employees', this.config.baseUrl);
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
    // TODO: confirm path AND response shape with Ali Barlow — doc 5 notes
    // this endpoint has no structured fields in the API Explorer.
    const url = new URL('/peoplesystem/employmentrecords', this.config.baseUrl);
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

  private headers(): Record<string, string> {
    return {
      'X-Fourth-Org-Token': this.config.orgToken,
      'X-Fourth-Org-Id': this.config.orgId,
      Accept: 'application/json',
    };
  }
}

function checkTenure(
  employment: EmploymentRecordApiRow[],
  minTenureDays: number,
): { passes: true } | { passes: false; reason: string } {
  const active = employment.find((e) => !e.EndDate);
  if (!active) {
    return { passes: false, reason: 'No active employment record' };
  }
  if (active.StartDate) {
    const start = new Date(active.StartDate);
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
