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
