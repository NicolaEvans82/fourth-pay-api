import { Injectable } from '@nestjs/common';
import { JORDAN_HARRIS_FAID, MARCUS_THOMPSON_FAID } from '../wfm/wfm.mock';
import {
  EligibilityResult,
  EmployerConfig,
  HrAdapter,
} from './hr.adapter';

// The Crown Pub Group — Jordan Harris's employer (docs/01-product-context.md).
export const CROWN_PUB_GROUP_EMPLOYER_ID = 'CROWN-PUB-GROUP';

const CROWN_PUB_GROUP_CONFIG: EmployerConfig = {
  fourthEmployerId: CROWN_PUB_GROUP_EMPLOYER_ID,
  maxAccessPercent: 50,
  feeSubsidised: false,
  minTenureDays: 90,
  enabled: true,
  payrollLockdownStartDay: 27,
  payrollLockdownEndDay: 31,
};

interface MockEmployee {
  faid: string;
  paybasis: string;
  ir35: boolean;
  active: boolean;
  startDate: Date;
}

// Jordan started ~21 months before the current docs date (2026-05-27).
// Marcus started ~9 months before — both safely past the 90-day tenure gate.
const EMPLOYEES: Record<string, MockEmployee> = {
  [JORDAN_HARRIS_FAID]: {
    faid: JORDAN_HARRIS_FAID,
    paybasis: 'monthly',
    ir35: false,
    active: true,
    startDate: new Date('2024-08-15T00:00:00Z'),
  },
  [MARCUS_THOMPSON_FAID]: {
    faid: MARCUS_THOMPSON_FAID,
    paybasis: 'monthly',
    ir35: false,
    active: true,
    startDate: new Date('2025-08-20T00:00:00Z'),
  },
};

@Injectable()
export class MockHrAdapter implements HrAdapter {
  async checkEligibility(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<EligibilityResult> {
    const employerConfig = configFor(input.fourthEmployerId);
    const employee = EMPLOYEES[input.fourthEmployeeId];

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
      faid: employee.faid,
      paybasis: employee.paybasis,
      employerConfig,
    };

    if (!employerConfig.enabled) {
      return {
        eligible: false,
        reason: 'EWA not enabled for this employer',
        ...base,
      };
    }
    if (employee.ir35) {
      return {
        eligible: false,
        reason: 'Inside IR35 — not eligible for EWA',
        ...base,
      };
    }
    if (!employee.active) {
      return {
        eligible: false,
        reason: 'No active employment record',
        ...base,
      };
    }

    const days = Math.floor(
      (Date.now() - employee.startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days < employerConfig.minTenureDays) {
      return {
        eligible: false,
        reason: `Below minimum tenure (${days}/${employerConfig.minTenureDays} days)`,
        ...base,
      };
    }

    return { eligible: true, ...base };
  }
}

function configFor(fourthEmployerId: string): EmployerConfig {
  if (fourthEmployerId === CROWN_PUB_GROUP_EMPLOYER_ID) {
    return CROWN_PUB_GROUP_CONFIG;
  }
  // Match the real adapter's behaviour for un-onboarded employers
  // (PgEmployerConfigReader returns null → FourthHrAdapter throws).
  throw new Error(
    `No employer_config row for ${fourthEmployerId} — employer onboarding incomplete`,
  );
}
