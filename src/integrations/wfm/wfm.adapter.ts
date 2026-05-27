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
}

export interface WfmAdapter {
  getConfirmedShifts(input: {
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
    // TODO: confirm endpoint path and query-param names with Ali Barlow.
    // Doc 5 names this as "GET Approved hours" on the PeopleSystem
    // Integration API but does not specify the URL pattern.
    const url = new URL('/peoplesystem/approvedhours', this.config.baseUrl);
    url.searchParams.set('FAID', input.fourthEmployeeId);
    url.searchParams.set('from', toIsoDate(input.from));
    url.searchParams.set('to', toIsoDate(input.to));

    const response = await fetch(url, {
      headers: {
        // TODO: confirm auth header name with Ali Barlow.
        'X-Fourth-Org-Token': this.config.orgToken,
        'X-Fourth-Org-Id': this.config.orgId,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Fourth HCM Approved Hours request failed (${response.status})`,
      );
    }

    const rows = (await response.json()) as ApprovedHoursApiRow[];
    return rows.map(toShiftRecord);
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
  };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
