import { Inject, Injectable } from '@nestjs/common';
import {
  DEMO_CROWN_ENROLMENT_COUNT,
  EWA_TRANSFER_READER,
  type EwaTransfer,
  type EwaTransferReader,
} from '../../database/ewa-transfer.store';
import { CROWN_PUB_GROUP_EMPLOYER_ID } from '../../integrations/hr/hr.mock';
import type { DailyAccessPoint, EmployerStatsResponse } from './dtos';

const INSTANT_FEE_GBP = 1.95;

@Injectable()
export class EmployerStatsService {
  constructor(
    @Inject(EWA_TRANSFER_READER)
    private readonly transfers: EwaTransferReader,
  ) {}

  async getStats(employerId: string): Promise<EmployerStatsResponse> {
    const totalEnrolled = enrolmentFor(employerId);
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const all = await this.transfers.listAll();
    const thisMonth = all.filter(
      (t) =>
        t.status !== 'failed' &&
        t.status !== 'reversed' &&
        t.initiatedAt >= monthStart,
    );

    const totalAmount = sum(thisMonth.map((t) => t.requestedAmount));
    const instantCount = thisMonth.filter(
      (t) => t.transferSpeed === 'instant',
    ).length;
    const distinctActive = new Set(
      thisMonth.map((t) => t.employeeAccountId),
    ).size;
    const average =
      thisMonth.length > 0 ? totalAmount / thisMonth.length : 0;
    const percentActive =
      totalEnrolled > 0
        ? Math.round((distinctActive / totalEnrolled) * 1000) / 10
        : 0;

    return {
      employer_id: employerId,
      total_employees_enrolled: totalEnrolled,
      total_transfers_this_month: thisMonth.length,
      total_amount_accessed_this_month: round2(totalAmount),
      average_transfer_amount: round2(average),
      fee_revenue_this_month: round2(instantCount * INSTANT_FEE_GBP),
      percent_of_workforce_active: percentActive,
      daily_access_amounts: dailyBuckets(all),
    };
  }
}

function enrolmentFor(employerId: string): number {
  // Mock universe has one employer with seeded enrolment. Production
  // would query employee_accounts WHERE fourth_employer_id = ?.
  if (employerId === CROWN_PUB_GROUP_EMPLOYER_ID) {
    return DEMO_CROWN_ENROLMENT_COUNT;
  }
  return 0;
}

function dailyBuckets(transfers: EwaTransfer[]): DailyAccessPoint[] {
  const out: DailyAccessPoint[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const day = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i),
    );
    const next = new Date(day.getTime() + 86400000);
    const amount = sum(
      transfers
        .filter(
          (t) =>
            t.status !== 'failed' &&
            t.status !== 'reversed' &&
            t.initiatedAt >= day &&
            t.initiatedAt < next,
        )
        .map((t) => t.requestedAmount),
    );
    out.push({ date: day.toISOString().slice(0, 10), amount: round2(amount) });
  }
  return out;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
