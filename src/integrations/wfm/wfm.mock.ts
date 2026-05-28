import { Injectable } from '@nestjs/common';
import { ShiftRecord, WfmAdapter } from './wfm.adapter';

// Jordan Harris — Bar Supervisor, The Crown Pub Group (docs/01-product-context.md).
// FAID format is 18-char alphanumeric per docs/05-integration-contracts.md.
export const JORDAN_HARRIS_FAID = 'JORDANHARRIS000001';

// Marcus Thompson — Hotel Receptionist, The Crown Pub Group. Different
// shift pattern (6 daytime shifts, Basic Hours only, no overtime / bank
// holiday premium) so the prototype can demonstrate a second persona.
export const MARCUS_THOMPSON_FAID = 'MARCUSTHOMPSON000001';

interface FixtureRow extends ShiftRecord {
  fourthEmployeeId: string;
}

// Pay period 1–31 May 2026. Period-to-date earnings: £625.00
//   Basic Hours          44h × £12.50 = £550.00
//   Bank Holiday (4 May)  6h × £6.25  =  £37.50  (premium element row)
//   Overtime (8→9 May)    3h × £12.50 =  £37.50
const FIXTURE: FixtureRow[] = [
  {
    fourthEmployeeId: JORDAN_HARRIS_FAID,
    site: 'The Crown — Soho',
    role: 'Bar Supervisor',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-02T17:00:00Z'),
    endDateTime: new Date('2026-05-02T23:00:00Z'),
    units: 6,
    rate: 12.5,
    value: 75.0,
    submittedToPayroll: false,
  },
  {
    fourthEmployeeId: JORDAN_HARRIS_FAID,
    site: 'The Crown — Soho',
    role: 'Bar Supervisor',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-03T15:00:00Z'),
    endDateTime: new Date('2026-05-03T20:00:00Z'),
    units: 5,
    rate: 12.5,
    value: 62.5,
    submittedToPayroll: false,
  },
  {
    fourthEmployeeId: JORDAN_HARRIS_FAID,
    site: 'The Crown — Soho',
    role: 'Bar Supervisor',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-04T15:00:00Z'),
    endDateTime: new Date('2026-05-04T21:00:00Z'),
    units: 6,
    rate: 12.5,
    value: 75.0,
    submittedToPayroll: false,
  },
  {
    fourthEmployeeId: JORDAN_HARRIS_FAID,
    elementName: 'Bank Holiday',
    startDateTime: new Date('2026-05-04T15:00:00Z'),
    endDateTime: new Date('2026-05-04T21:00:00Z'),
    units: 6,
    rate: 6.25,
    value: 37.5,
    submittedToPayroll: false,
  },
  {
    fourthEmployeeId: JORDAN_HARRIS_FAID,
    site: 'The Crown — Soho',
    role: 'Bar Supervisor',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-08T18:00:00Z'),
    endDateTime: new Date('2026-05-08T23:00:00Z'),
    units: 5,
    rate: 12.5,
    value: 62.5,
    submittedToPayroll: false,
  },
  {
    fourthEmployeeId: JORDAN_HARRIS_FAID,
    elementName: 'Overtime',
    startDateTime: new Date('2026-05-08T23:00:00Z'),
    endDateTime: new Date('2026-05-09T02:00:00Z'),
    units: 3,
    rate: 12.5,
    value: 37.5,
    submittedToPayroll: false,
  },
  {
    fourthEmployeeId: JORDAN_HARRIS_FAID,
    site: 'The Crown — Soho',
    role: 'Bar Supervisor',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-09T17:00:00Z'),
    endDateTime: new Date('2026-05-09T23:00:00Z'),
    units: 6,
    rate: 12.5,
    value: 75.0,
    submittedToPayroll: false,
  },
  {
    fourthEmployeeId: JORDAN_HARRIS_FAID,
    site: 'The Crown — Soho',
    role: 'Bar Supervisor',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-13T16:00:00Z'),
    endDateTime: new Date('2026-05-13T22:00:00Z'),
    units: 6,
    rate: 12.5,
    value: 75.0,
    submittedToPayroll: false,
  },
  {
    fourthEmployeeId: JORDAN_HARRIS_FAID,
    site: 'The Crown — Soho',
    role: 'Bar Supervisor',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-16T17:00:00Z'),
    endDateTime: new Date('2026-05-16T22:00:00Z'),
    units: 5,
    rate: 12.5,
    value: 62.5,
    submittedToPayroll: false,
  },
  {
    fourthEmployeeId: JORDAN_HARRIS_FAID,
    site: 'The Crown — Soho',
    role: 'Bar Supervisor',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-23T17:00:00Z'),
    endDateTime: new Date('2026-05-23T22:00:00Z'),
    units: 5,
    rate: 12.5,
    value: 62.5,
    submittedToPayroll: false,
  },
  // Marcus Thompson — 6 daytime reception shifts, Basic Hours only, all
  // 6h at £11.44/hr. 36h × £11.44 = £411.84 gross for the period.
  {
    fourthEmployeeId: MARCUS_THOMPSON_FAID,
    site: 'Crown Hotel — Manchester',
    role: 'Hotel Receptionist',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-04T09:00:00Z'),
    endDateTime: new Date('2026-05-04T15:00:00Z'),
    units: 6,
    rate: 11.44,
    value: 68.64,
    submittedToPayroll: false,
  },
  {
    fourthEmployeeId: MARCUS_THOMPSON_FAID,
    site: 'Crown Hotel — Manchester',
    role: 'Hotel Receptionist',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-06T14:00:00Z'),
    endDateTime: new Date('2026-05-06T20:00:00Z'),
    units: 6,
    rate: 11.44,
    value: 68.64,
    submittedToPayroll: false,
  },
  {
    fourthEmployeeId: MARCUS_THOMPSON_FAID,
    site: 'Crown Hotel — Manchester',
    role: 'Hotel Receptionist',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-09T09:00:00Z'),
    endDateTime: new Date('2026-05-09T15:00:00Z'),
    units: 6,
    rate: 11.44,
    value: 68.64,
    submittedToPayroll: false,
  },
  {
    fourthEmployeeId: MARCUS_THOMPSON_FAID,
    site: 'Crown Hotel — Manchester',
    role: 'Hotel Receptionist',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-13T09:00:00Z'),
    endDateTime: new Date('2026-05-13T15:00:00Z'),
    units: 6,
    rate: 11.44,
    value: 68.64,
    submittedToPayroll: false,
  },
  {
    fourthEmployeeId: MARCUS_THOMPSON_FAID,
    site: 'Crown Hotel — Manchester',
    role: 'Hotel Receptionist',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-19T14:00:00Z'),
    endDateTime: new Date('2026-05-19T20:00:00Z'),
    units: 6,
    rate: 11.44,
    value: 68.64,
    submittedToPayroll: false,
  },
  {
    fourthEmployeeId: MARCUS_THOMPSON_FAID,
    site: 'Crown Hotel — Manchester',
    role: 'Hotel Receptionist',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-23T09:00:00Z'),
    endDateTime: new Date('2026-05-23T15:00:00Z'),
    units: 6,
    rate: 11.44,
    value: 68.64,
    submittedToPayroll: false,
  },
];

// Rostered (future) shifts — NOT counted toward earnings. The mock
// "current" date for the demo is 2026-05-28, so anything ≥ 2026-05-29
// is forward-looking.
//
// Jordan keeps a pub-evening / weekend pattern; Marcus runs a hotel
// reception early-morning / day pattern. Both span the May → June
// boundary so the prototype's 'next 7 days' window has content.
const SCHEDULED_FIXTURE: FixtureRow[] = [
  // Jordan — pub Friday night
  {
    fourthEmployeeId: JORDAN_HARRIS_FAID,
    site: 'The Crown — Soho',
    role: 'Bar Supervisor',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-29T17:00:00Z'),
    endDateTime: new Date('2026-05-29T23:00:00Z'),
    units: 6,
    rate: 12.5,
    value: 75.0,
    submittedToPayroll: false,
  },
  // Jordan — Saturday late
  {
    fourthEmployeeId: JORDAN_HARRIS_FAID,
    site: 'The Crown — Soho',
    role: 'Bar Supervisor',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-30T17:00:00Z'),
    endDateTime: new Date('2026-05-31T01:00:00Z'),
    units: 8,
    rate: 12.5,
    value: 100.0,
    submittedToPayroll: false,
  },
  // Jordan — Sunday afternoon
  {
    fourthEmployeeId: JORDAN_HARRIS_FAID,
    site: 'The Crown — Soho',
    role: 'Bar Supervisor',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-31T14:00:00Z'),
    endDateTime: new Date('2026-05-31T20:00:00Z'),
    units: 6,
    rate: 12.5,
    value: 75.0,
    submittedToPayroll: false,
  },
  // Jordan — Tuesday evening (next period)
  {
    fourthEmployeeId: JORDAN_HARRIS_FAID,
    site: 'The Crown — Soho',
    role: 'Bar Supervisor',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-06-02T17:00:00Z'),
    endDateTime: new Date('2026-06-02T22:00:00Z'),
    units: 5,
    rate: 12.5,
    value: 62.5,
    submittedToPayroll: false,
  },
  // Jordan — Thursday evening (next period)
  {
    fourthEmployeeId: JORDAN_HARRIS_FAID,
    site: 'The Crown — Soho',
    role: 'Bar Supervisor',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-06-04T17:00:00Z'),
    endDateTime: new Date('2026-06-04T23:00:00Z'),
    units: 6,
    rate: 12.5,
    value: 75.0,
    submittedToPayroll: false,
  },
  // Marcus — Friday early morning
  {
    fourthEmployeeId: MARCUS_THOMPSON_FAID,
    site: 'Crown Hotel — Manchester',
    role: 'Hotel Receptionist',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-29T06:00:00Z'),
    endDateTime: new Date('2026-05-29T12:00:00Z'),
    units: 6,
    rate: 11.44,
    value: 68.64,
    submittedToPayroll: false,
  },
  // Marcus — Saturday early morning
  {
    fourthEmployeeId: MARCUS_THOMPSON_FAID,
    site: 'Crown Hotel — Manchester',
    role: 'Hotel Receptionist',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-30T06:00:00Z'),
    endDateTime: new Date('2026-05-30T12:00:00Z'),
    units: 6,
    rate: 11.44,
    value: 68.64,
    submittedToPayroll: false,
  },
  // Marcus — Monday day shift (next period)
  {
    fourthEmployeeId: MARCUS_THOMPSON_FAID,
    site: 'Crown Hotel — Manchester',
    role: 'Hotel Receptionist',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-06-01T09:00:00Z'),
    endDateTime: new Date('2026-06-01T15:00:00Z'),
    units: 6,
    rate: 11.44,
    value: 68.64,
    submittedToPayroll: false,
  },
  // Marcus — Wednesday early morning (next period)
  {
    fourthEmployeeId: MARCUS_THOMPSON_FAID,
    site: 'Crown Hotel — Manchester',
    role: 'Hotel Receptionist',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-06-03T06:00:00Z'),
    endDateTime: new Date('2026-06-03T12:00:00Z'),
    units: 6,
    rate: 11.44,
    value: 68.64,
    submittedToPayroll: false,
  },
  // Marcus — Thursday day shift (next period)
  {
    fourthEmployeeId: MARCUS_THOMPSON_FAID,
    site: 'Crown Hotel — Manchester',
    role: 'Hotel Receptionist',
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-06-04T09:00:00Z'),
    endDateTime: new Date('2026-06-04T15:00:00Z'),
    units: 6,
    rate: 11.44,
    value: 68.64,
    submittedToPayroll: false,
  },
];

@Injectable()
export class MockWfmAdapter implements WfmAdapter {
  async getConfirmedShifts(input: {
    fourthEmployeeId: string;
    from: Date;
    to: Date;
  }): Promise<ShiftRecord[]> {
    return FIXTURE.filter(
      (row) =>
        row.fourthEmployeeId === input.fourthEmployeeId &&
        row.startDateTime >= input.from &&
        row.startDateTime <= input.to,
    ).map(({ fourthEmployeeId: _faid, ...shift }) => shift);
  }

  async getScheduledShifts(input: {
    fourthEmployeeId: string;
    from: Date;
    to: Date;
  }): Promise<ShiftRecord[]> {
    return SCHEDULED_FIXTURE.filter(
      (row) =>
        row.fourthEmployeeId === input.fourthEmployeeId &&
        row.startDateTime >= input.from &&
        row.startDateTime <= input.to,
    ).map(({ fourthEmployeeId: _faid, ...shift }) => shift);
  }
}
