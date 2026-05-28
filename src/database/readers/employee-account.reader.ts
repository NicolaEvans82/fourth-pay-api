import { Injectable } from '@nestjs/common';
import { CROWN_PUB_GROUP_EMPLOYER_ID } from '../../integrations/hr/hr.mock';
import {
  JORDAN_HARRIS_FAID,
  MARCUS_THOMPSON_FAID,
} from '../../integrations/wfm/wfm.mock';

export const EMPLOYEE_ACCOUNT_READER = Symbol('EmployeeAccountReader');

export interface EmployeeAccount {
  id: string;
  fourthEmployeeId: string;
  fourthEmployerId: string;
  status: 'active' | 'paused' | 'suspended' | 'closed';
}

export interface EmployeeAccountReader {
  findByFourthEmployeeId(faid: string): Promise<EmployeeAccount | null>;
}

export const JORDAN_ACCOUNT: EmployeeAccount = {
  id: '00000000-0000-0000-0000-000000000001',
  fourthEmployeeId: JORDAN_HARRIS_FAID,
  fourthEmployerId: CROWN_PUB_GROUP_EMPLOYER_ID,
  status: 'active',
};

export const MARCUS_ACCOUNT: EmployeeAccount = {
  id: '11111111-1111-1111-1111-111111111111',
  fourthEmployeeId: MARCUS_THOMPSON_FAID,
  fourthEmployerId: CROWN_PUB_GROUP_EMPLOYER_ID,
  status: 'active',
};

const ACCOUNTS_BY_FAID: ReadonlyMap<string, EmployeeAccount> = new Map([
  [JORDAN_ACCOUNT.fourthEmployeeId, JORDAN_ACCOUNT],
  [MARCUS_ACCOUNT.fourthEmployeeId, MARCUS_ACCOUNT],
]);

@Injectable()
export class MockEmployeeAccountReader implements EmployeeAccountReader {
  async findByFourthEmployeeId(
    faid: string,
  ): Promise<EmployeeAccount | null> {
    return ACCOUNTS_BY_FAID.get(faid) ?? null;
  }
}
