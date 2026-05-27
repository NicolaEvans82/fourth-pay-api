import { Injectable } from '@nestjs/common';
import { CROWN_PUB_GROUP_EMPLOYER_ID } from '../../integrations/hr/hr.mock';
import { JORDAN_HARRIS_FAID } from '../../integrations/wfm/wfm.mock';

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

const JORDAN_ACCOUNT: EmployeeAccount = {
  id: '00000000-0000-0000-0000-000000000001',
  fourthEmployeeId: JORDAN_HARRIS_FAID,
  fourthEmployerId: CROWN_PUB_GROUP_EMPLOYER_ID,
  status: 'active',
};

@Injectable()
export class MockEmployeeAccountReader implements EmployeeAccountReader {
  async findByFourthEmployeeId(
    faid: string,
  ): Promise<EmployeeAccount | null> {
    return faid === JORDAN_ACCOUNT.fourthEmployeeId ? JORDAN_ACCOUNT : null;
  }
}
