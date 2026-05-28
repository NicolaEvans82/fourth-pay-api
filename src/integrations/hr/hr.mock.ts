import { Injectable } from '@nestjs/common';
import { JORDAN_HARRIS_FAID, MARCUS_THOMPSON_FAID } from '../wfm/wfm.mock';
import {
  EligibilityResult,
  EmployerConfig,
  EmploymentProfile,
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
  // UK statutory minimum employer contribution for auto-enrolled
  // employees. The full minimum is 8% total (3% employer + 5%
  // employee); Crown Pub Group sticks to the minimum.
  pensionEmployerContributionPercent: 3,
  // Employer-specific perks shown in the Discounts screen. Production
  // should move this to a JSONB column on employer_config (not yet
  // migrated) — for the demo this lives on the mock config object.
  perks: [
    {
      name: 'Staff meal allowance',
      description: '50% off any meal during your shift at any Crown venue',
      value: '50%',
    },
    {
      name: 'Crown Hotel staff rate',
      description: '£25/night for staff + 1 guest at any Crown Hotel UK',
      value: '£25/night',
    },
    {
      name: 'Refer a friend',
      description: '£250 bonus for any colleague who joins and stays 90 days',
      value: '£250',
    },
  ],
};

interface MockEmployee {
  faid: string;
  paybasis: string;
  ir35: boolean;
  active: boolean;
  startDate: Date;
  // Additional fields BenefitsService relies on. Production reads
  // these from the API Employees + Employments rows directly.
  dateOfBirth: Date;
  isFulltime: boolean;
  rateOfPay: number;
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
    dateOfBirth: new Date('1998-03-12T00:00:00Z'),
    isFulltime: true,
    rateOfPay: 12.5,
  },
  [MARCUS_THOMPSON_FAID]: {
    faid: MARCUS_THOMPSON_FAID,
    paybasis: 'monthly',
    ir35: false,
    active: true,
    startDate: new Date('2025-08-20T00:00:00Z'),
    dateOfBirth: new Date('2001-07-04T00:00:00Z'),
    isFulltime: false,
    rateOfPay: 11.44,
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

  async getEmploymentProfile(input: {
    fourthEmployeeId: string;
  }): Promise<EmploymentProfile | null> {
    const employee = EMPLOYEES[input.fourthEmployeeId];
    if (!employee) return null;
    return {
      dateOfBirth: employee.dateOfBirth,
      employmentStartDate: employee.startDate,
      isFulltime: employee.isFulltime,
      rateOfPay: employee.rateOfPay,
      paybasis: employee.paybasis,
    };
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
