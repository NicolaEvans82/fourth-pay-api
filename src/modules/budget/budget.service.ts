import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EMPLOYEE_ACCOUNT_READER,
  type EmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import {
  EWA_TRANSFER_READER,
  type EwaTransferReader,
} from '../../database/ewa-transfer.store';
import { BalanceService } from '../ewa/balance.service';

// Classic 50/30/20 envelope.
const NEEDS_FRACTION = 0.5;
const WANTS_FRACTION = 0.3;
const SAVINGS_FRACTION = 0.2;

export interface BudgetCategory {
  allocated: number;
  used: number;
  remaining: number;
}

export interface BudgetResponse {
  payPeriodStart: string;
  payPeriodEnd: string;
  monthlyEarnings: number;
  needs: BudgetCategory;
  wants: BudgetCategory;
  savings: BudgetCategory;
}

@Injectable()
export class BudgetService {
  constructor(
    private readonly balance: BalanceService,
    @Inject(EMPLOYEE_ACCOUNT_READER)
    private readonly employees: EmployeeAccountReader,
    @Inject(EWA_TRANSFER_READER)
    private readonly transfers: EwaTransferReader,
  ) {}

  async getBudget(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<BudgetResponse> {
    // Use the current pay period's gross earnings as the budget base.
    // For mid-period requests this is partial — the prototype shows it
    // as "this period's budget" rather than a 12-month projection.
    const balance = await this.balance.getBalance(input);
    const monthly = balance.earnedAmount;

    const needsAlloc = round2(monthly * NEEDS_FRACTION);
    const wantsAlloc = round2(monthly * WANTS_FRACTION);
    const savingsAlloc = round2(monthly * SAVINGS_FRACTION);

    // EWA accessed is treated as drawing from "needs" — early access
    // is typically for bills / essentials, not discretionary spend.
    // Prototype-level approximation; real spending tracking would need
    // an Open Banking feed.
    const employee = await this.employees.findByFourthEmployeeId(
      input.fourthEmployeeId,
    );
    if (!employee) {
      throw new NotFoundException(
        'Employee account not enrolled in Fourth Pay',
      );
    }
    const accessedThisPeriod = await this.transfers.sumAdvancesInPeriod({
      employeeAccountId: employee.id,
      payPeriodStart: balance.payPeriodStart,
    });

    return {
      payPeriodStart: balance.payPeriodStart.toISOString(),
      payPeriodEnd: balance.payPeriodEnd.toISOString(),
      monthlyEarnings: monthly,
      needs: makeCategory(needsAlloc, accessedThisPeriod),
      // We don't track discretionary or savings spend without Open
      // Banking. Surface allocations only — "used" stays at 0 so the
      // UI can show "budgeted" without lying about consumption.
      wants: makeCategory(wantsAlloc, 0),
      savings: makeCategory(savingsAlloc, 0),
    };
  }
}

function makeCategory(allocated: number, used: number): BudgetCategory {
  return {
    allocated,
    used: round2(used),
    remaining: round2(Math.max(0, allocated - used)),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
