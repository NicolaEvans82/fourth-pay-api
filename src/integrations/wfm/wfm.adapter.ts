import { Inject, Injectable } from '@nestjs/common';
import {
  FOURTH_HCM_CONFIG,
  type FourthHcmConfig,
} from '../fourth-hcm.config';

export const WFM_ADAPTER = Symbol('WfmAdapter');

export interface ShiftRecord {
  elementName: string;
  startDateTime: Date;
  endDateTime: Date;
  units: number;
  rate: number;
  value: number;
  submittedToPayroll: boolean;
  // Optional metadata — populated by the mock for prototype display; the
  // production adapter maps them from Department/JobDescription/SiteDescription
  // if present on the source row.
  site?: string;
  role?: string;
}

export interface WfmAdapter {
  getConfirmedShifts(input: {
    fourthEmployeeId: string;
    from: Date;
    to: Date;
  }): Promise<ShiftRecord[]>;
  // Forward-looking shifts (rostered but not yet approved hours). Kept
  // distinct from confirmed shifts so they do NOT inflate the earnings
  // calc, which counts only confirmed/approved hours.
  getScheduledShifts(input: {
    fourthEmployeeId: string;
    from: Date;
    to: Date;
  }): Promise<ShiftRecord[]>;
}

interface ApprovedHoursApiRow {
  EmployeeID: number;
  ElementName: string;
  ElementLocalRef?: string;
  StartDateTime: string;
  EndDateTime: string;
  Units: number;
  UnitType?: string;
  Rate: number;
  Value: number;
  ActHours?: number;
  Department?: string;
  JobDescription?: string;
  SiteDescription?: string;
  SubmittedToPayroll: 'Yes' | 'No';
}

@Injectable()
export class FourthWfmAdapter implements WfmAdapter {
  constructor(
    @Inject(FOURTH_HCM_CONFIG)
    private readonly config: FourthHcmConfig,
  ) {}

  async getConfirmedShifts(input: {
    fourthEmployeeId: string;
    from: Date;
    to: Date;
  }): Promise<ShiftRecord[]> {
    // Confirmed by Ali Barlow on 2026-05-28:
    //   URL    : http://10.12.6.10:85/Organisations/{OrganisationID}/Employees/ApprovedHours
    //   Params : Start, Duration, DateFrom, DateTo, Delta=False
    //   Auth   : X-Fourth-Org header carrying the OrganisationID/GroupID
    //
    // NOTE: 10.12.6.10:85 is **internal to Fourth's network** and will not
    // resolve from outside Fourth infrastructure. The Railway demo
    // therefore routes via MockWfmAdapter (see wfm.module.ts); this
    // adapter only runs when the API is deployed inside Fourth.
    //
    // Approved Hours is the source for the earnings calc (gross_earned =
    // SUM(Value) for the period — see docs/01-product-context.md).
    const url = new URL(
      `/Organisations/${encodeURIComponent(this.config.orgId)}/Employees/ApprovedHours`,
      this.config.baseUrl,
    );
    url.searchParams.set('Start', '0');
    url.searchParams.set('Duration', '1000');
    url.searchParams.set('DateFrom', toIsoDate(input.from));
    url.searchParams.set('DateTo', toIsoDate(input.to));
    url.searchParams.set('Delta', 'False');

    const response = await fetch(url, {
      headers: {
        'X-Fourth-Org': this.config.orgId,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Fourth HCM Approved Hours request failed (${response.status})`,
      );
    }

    // ApprovedHours rows carry EmployeeID (numeric) but not FAID, and the
    // confirmed query params have no employee filter — the endpoint
    // returns every employee in the org. We need a FAID → EmployeeID
    // resolution step (Get Employees) before we can filter; until that
    // lookup is wired, return all org rows so the caller at least gets
    // the right shape. Caller must guard against cross-employee leakage.
    const employeeIdForFaid = await this.resolveEmployeeId(
      input.fourthEmployeeId,
    );
    const rows = (await response.json()) as ApprovedHoursApiRow[];
    const filtered =
      employeeIdForFaid === null
        ? rows
        : rows.filter((r) => r.EmployeeID === employeeIdForFaid);
    return filtered.map(toShiftRecord);
  }

  // Placeholder — needs to call GET Employees and cache the FAID ↔
  // EmployeeID mapping. Returning null disables filtering, which is
  // safe only inside the closed Fourth network for the demo org.
  private async resolveEmployeeId(_faid: string): Promise<number | null> {
    return null;
  }

  async getScheduledShifts(_input: {
    fourthEmployeeId: string;
    from: Date;
    to: Date;
  }): Promise<ShiftRecord[]> {
    // TODO: wire up the Fourth WFM rostered-shifts endpoint with Ali
    // Barlow — Approved Hours only returns worked shifts. For now the
    // production adapter returns no rostered shifts.
    return [];
  }
}

function toShiftRecord(row: ApprovedHoursApiRow): ShiftRecord {
  return {
    elementName: row.ElementName,
    startDateTime: new Date(row.StartDateTime),
    endDateTime: new Date(row.EndDateTime),
    units: row.Units,
    rate: row.Rate,
    value: row.Value,
    submittedToPayroll: row.SubmittedToPayroll === 'Yes',
    site: row.SiteDescription,
    role: row.JobDescription,
  };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
