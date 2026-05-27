import { Injectable } from '@nestjs/common';
import { ShiftRecord, WfmAdapter } from './wfm.adapter';

// Jordan Harris — Bar Supervisor, The Crown Pub Group (docs/01-product-context.md).
// FAID format is 18-char alphanumeric per docs/05-integration-contracts.md.
export const JORDAN_HARRIS_FAID = 'JORDANHARRIS000001';

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
    elementName: 'Basic Hours',
    startDateTime: new Date('2026-05-23T17:00:00Z'),
    endDateTime: new Date('2026-05-23T22:00:00Z'),
    units: 5,
    rate: 12.5,
    value: 62.5,
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
}
