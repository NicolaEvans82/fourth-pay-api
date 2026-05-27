import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EWA_TRANSFER_READER,
  type EwaTransferReader,
} from '../../database/ewa-transfer.store';
import {
  EMPLOYEE_ACCOUNT_READER,
  type EmployeeAccountReader,
} from '../../database/readers/employee-account.reader';
import {
  WFM_ADAPTER,
  type ShiftRecord,
  type WfmAdapter,
} from '../../integrations/wfm/wfm.adapter';
import { BalanceService } from './balance.service';

export interface EarningsShift {
  elementName: string;
  startDateTime: Date;
  endDateTime: Date;
  hours: number;
  rate: number;
  value: number;
}

export interface EarningsResponse {
  payPeriodStart: Date;
  payPeriodEnd: Date;
  shifts: EarningsShift[];
  summary: {
    grossEarned: number;
    availableAmount: number | null;
    accessedAmount: number;
  };
}

@Injectable()
export class EarningsService {
  constructor(
    @Inject(WFM_ADAPTER) private readonly wfm: WfmAdapter,
    @Inject(EMPLOYEE_ACCOUNT_READER)
    private readonly employees: EmployeeAccountReader,
    @Inject(EWA_TRANSFER_READER)
    private readonly transfers: EwaTransferReader,
    private readonly balance: BalanceService,
  ) {}

  async getEarnings(input: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
    payPeriodStart?: Date;
  }): Promise<EarningsResponse> {
    if (input.payPeriodStart) {
      return this.getHistorical(input.fourthEmployeeId, input.payPeriodStart);
    }
    return this.getCurrent({
      fourthEmployeeId: input.fourthEmployeeId,
      fourthEmployerId: input.fourthEmployerId,
    });
  }

  private async getCurrent(ctx: {
    fourthEmployeeId: string;
    fourthEmployerId: string;
  }): Promise<EarningsResponse> {
    const balance = await this.balance.getBalance(ctx);
    const shifts = await this.wfm.getConfirmedShifts({
      fourthEmployeeId: ctx.fourthEmployeeId,
      from: balance.payPeriodStart,
      to: balance.payPeriodEnd,
    });
    return this.format(
      balance.payPeriodStart,
      balance.payPeriodEnd,
      shifts,
      balance.accessedAmount,
      balance.availableAmount,
    );
  }

  private async getHistorical(
    fourthEmployeeId: string,
    periodStart: Date,
  ): Promise<EarningsResponse> {
    // Calendar-month range: [periodStart, last day of that month 23:59:59].
    const periodEnd = new Date(
      Date.UTC(
        periodStart.getUTCFullYear(),
        periodStart.getUTCMonth() + 1,
        0,
        23,
        59,
        59,
      ),
    );
    const shifts = await this.wfm.getConfirmedShifts({
      fourthEmployeeId,
      from: periodStart,
      to: periodEnd,
    });
    const employee = await this.employees.findByFourthEmployeeId(
      fourthEmployeeId,
    );
    if (!employee) {
      throw new NotFoundException(
        'Employee account not enrolled in Fourth Pay',
      );
    }
    const accessedAmount = await this.transfers.sumAdvancesInPeriod({
      employeeAccountId: employee.id,
      payPeriodStart: periodStart,
    });
    return this.format(periodStart, periodEnd, shifts, accessedAmount, null);
  }

  private format(
    payPeriodStart: Date,
    payPeriodEnd: Date,
    shifts: ShiftRecord[],
    accessedAmount: number,
    availableAmount: number | null,
  ): EarningsResponse {
    const grossEarned = shifts.reduce((sum, s) => sum + s.value, 0);
    return {
      payPeriodStart,
      payPeriodEnd,
      shifts: shifts.map((s) => ({
        elementName: s.elementName,
        startDateTime: s.startDateTime,
        endDateTime: s.endDateTime,
        hours: s.units,
        rate: s.rate,
        value: s.value,
      })),
      summary: {
        grossEarned: round2(grossEarned),
        availableAmount:
          availableAmount === null ? null : round2(availableAmount),
        accessedAmount: round2(accessedAmount),
      },
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
