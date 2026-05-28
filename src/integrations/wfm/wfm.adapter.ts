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

// FAID → EmployeeID mappings are essentially immutable (an employee's
// internal numeric ID doesn't change), so caching for the lifetime of
// the process is correct. If a real refresh signal ever lands (e.g.
// an employee is re-onboarded under a new ID), invalidate by process
// restart or by adding a TTL here.
type EmployeeIdCache = Map<string, number>;

@Injectable()
export class FourthWfmAdapter implements WfmAdapter {
  private readonly employeeIdCache: EmployeeIdCache = new Map();

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
    // Path casing — intentional and matches the confirmed API paths:
    // WFM endpoints use **capital** `/Organisations/`, while HR and
    // Payroll endpoints use **lowercase** `/organisations/`. Do not
    // normalise across adapters without re-checking with Ali — the
    // API Explorer confirmed both forms.
    //
    // NOTE: 10.12.6.10:85 is **internal to Fourth's network** and will not
    // resolve from outside Fourth infrastructure. The Railway demo
    // therefore routes via MockWfmAdapter (see wfm.module.ts); this
    // adapter only runs when the API is deployed inside Fourth.
    //
    // Approved Hours is the source for the earnings calc (gross_earned =
    // SUM(Value) for the period — see docs/01-product-context.md).
    //
    // ApprovedHours rows carry EmployeeID (numeric) but not FAID, and
    // the endpoint has no employee-scoping query param — it returns
    // every employee in the org. Resolve FAID → EmployeeID first
    // (CLAUDE.md rule 5 — never leak another employee's shift data),
    // then filter the response client-side.
    const employeeId = await this.resolveEmployeeId(input.fourthEmployeeId);
    if (employeeId === null) {
      // FAID does not exist in HR — return no shifts. Returning the
      // unfiltered org list would leak everyone else's data.
      return [];
    }

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

    const rows = (await response.json()) as ApprovedHoursApiRow[];
    return rows
      .filter((r) => r.EmployeeID === employeeId)
      .map(toShiftRecord);
  }

  // Resolves FAID → numeric EmployeeID via the HR-owned Get Employees
  // endpoint (same URL shape HrAdapter.fetchEmployee uses — see
  // hr.adapter.ts). Cached for the process lifetime; see
  // EmployeeIdCache above for the rationale.
  //
  // Note: this is a Get Employees call, which is **lowercase**
  // `/organisations/`, even though we're inside the WfmAdapter — the
  // casing follows the endpoint, not the calling adapter.
  private async resolveEmployeeId(faid: string): Promise<number | null> {
    const cached = this.employeeIdCache.get(faid);
    if (cached !== undefined) return cached;

    const url = new URL(
      `/organisations/${encodeURIComponent(this.config.orgId)}/Employees`,
      this.config.baseUrl,
    );
    url.searchParams.set('FAID', faid);

    const response = await fetch(url, {
      headers: {
        'X-Fourth-Org': this.config.orgId,
        Accept: 'application/json',
      },
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(
        `Fourth HCM Get Employees lookup failed (${response.status})`,
      );
    }
    const rows = (await response.json()) as Array<{
      EmployeeID: number;
      FAID: string;
    }>;
    const match = rows.find((r) => r.FAID === faid);
    if (!match) return null;
    this.employeeIdCache.set(faid, match.EmployeeID);
    return match.EmployeeID;
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
