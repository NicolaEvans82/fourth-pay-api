import { Injectable, type OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  JORDAN_ACCOUNT,
  MARCUS_ACCOUNT,
} from './readers/employee-account.reader';

export const EWA_TRANSFER_READER = Symbol('EwaTransferReader');
export const EWA_TRANSFER_WRITER = Symbol('EwaTransferWriter');

export type EwaTransferStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'reversed';

// 'gift_card' added alongside instant/standard — fee always 0 and
// effectively instant arrival. Stored as a third string in the
// transferSpeed column; no schema change needed because the column
// is already string-typed.
export type EwaTransferSpeed = 'instant' | 'standard' | 'gift_card';

export interface EwaTransfer {
  id: string;
  employeeAccountId: string;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  requestedAmount: number;
  feeAmount: number;
  feeSubsidised: boolean;
  netAmount: number;
  transferSpeed: EwaTransferSpeed;
  // Slug of the partner brand when transferSpeed === 'gift_card',
  // null otherwise. In Pg mode this maps to a new gift_card_partner
  // column (deferred — mock mode bypasses).
  giftCardPartner: string | null;
  status: EwaTransferStatus;
  bankAccountId: string | null;
  initiatedAt: Date;
  completedAt: Date | null;
  failureReason: string | null;
  fcaDisclosureShown: boolean;
  fcaDisclosureAt: Date | null;
  createdAt: Date;
}

export interface NewEwaTransfer {
  employeeAccountId: string;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  requestedAmount: number;
  feeAmount: number;
  feeSubsidised: boolean;
  netAmount: number;
  transferSpeed: EwaTransferSpeed;
  giftCardPartner: string | null;
  bankAccountId: string | null;
  fcaDisclosureShown: boolean;
  fcaDisclosureAt: Date | null;
}

export interface EwaTransferReader {
  sumAdvancesInPeriod(input: {
    employeeAccountId: string;
    payPeriodStart: Date;
  }): Promise<number>;
  findRecentByEmployee(input: {
    employeeAccountId: string;
    limit: number;
    payPeriodStart?: Date;
  }): Promise<EwaTransfer[]>;
  findLatestCompleted(employeeAccountId: string): Promise<EwaTransfer | null>;
  // Aggregate-only — for the employer dashboard. Production should filter
  // by employer ID via a join through employee_accounts.
  listAll(): Promise<EwaTransfer[]>;
}

export interface EwaTransferWriter {
  insert(input: NewEwaTransfer): Promise<EwaTransfer>;
  setStatus(input: {
    id: string;
    status: EwaTransferStatus;
    completedAt?: Date;
    failureReason?: string;
  }): Promise<EwaTransfer>;
}

// Single in-memory backing store. EwaModule binds the same instance to both
// reader and writer tokens via useExisting so writes are visible to reads.
@Injectable()
export class InMemoryEwaTransferStore
  implements EwaTransferReader, EwaTransferWriter, OnModuleInit
{
  private readonly transfers: EwaTransfer[] = [];

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    if (this.transfers.length > 0) return;
    this.seedAll();
  }

  // Demo-only: wipe the live state and re-run every seeder. Called from
  // POST /api/v1/demo/reset so a live demo can be repeated without
  // restarting the process.
  resetToSeed(): void {
    this.transfers.length = 0;
    this.seedAll();
  }

  private seedAll(): void {
    seedJordanTransfers(this.transfers);
    seedMarcusTransfers(this.transfers);
    seedAnonymousEmployerTransfers(this.transfers);
  }

  async listAll(): Promise<EwaTransfer[]> {
    return [...this.transfers];
  }

  async sumAdvancesInPeriod(input: {
    employeeAccountId: string;
    payPeriodStart: Date;
  }): Promise<number> {
    return this.transfers
      .filter(
        (t) =>
          t.employeeAccountId === input.employeeAccountId &&
          sameDay(t.payPeriodStart, input.payPeriodStart) &&
          t.status !== 'failed' &&
          t.status !== 'reversed',
      )
      .reduce((sum, t) => sum + t.requestedAmount, 0);
  }

  async findRecentByEmployee(input: {
    employeeAccountId: string;
    limit: number;
    payPeriodStart?: Date;
  }): Promise<EwaTransfer[]> {
    return this.transfers
      .filter((t) => {
        if (t.employeeAccountId !== input.employeeAccountId) return false;
        if (input.payPeriodStart && !sameDay(t.payPeriodStart, input.payPeriodStart)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.initiatedAt.getTime() - a.initiatedAt.getTime())
      .slice(0, input.limit);
  }

  async findLatestCompleted(
    employeeAccountId: string,
  ): Promise<EwaTransfer | null> {
    const completed = this.transfers
      .filter(
        (t) =>
          t.employeeAccountId === employeeAccountId && t.status === 'completed',
      )
      .sort(
        (a, b) =>
          (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
      );
    return completed[0] ?? null;
  }

  async insert(input: NewEwaTransfer): Promise<EwaTransfer> {
    const now = new Date();
    const transfer: EwaTransfer = {
      id: randomUUID(),
      ...input,
      status: 'pending',
      initiatedAt: now,
      completedAt: null,
      failureReason: null,
      createdAt: now,
    };
    this.transfers.push(transfer);
    return transfer;
  }

  async setStatus(input: {
    id: string;
    status: EwaTransferStatus;
    completedAt?: Date;
    failureReason?: string;
  }): Promise<EwaTransfer> {
    const transfer = this.transfers.find((t) => t.id === input.id);
    if (!transfer) {
      throw new Error(`EwaTransfer not found: ${input.id}`);
    }
    transfer.status = input.status;
    if (input.completedAt) transfer.completedAt = input.completedAt;
    if (input.failureReason) transfer.failureReason = input.failureReason;
    return transfer;
  }
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

// Anonymous transfers across ~46 other Crown Pub Group employees so the
// employer dashboard isn't just Jordan. Distribution is concentrated in
// the last 7 days (for the daily chart) with a smaller tail across the
// rest of the pay period. Deterministic — no Math.random — so demo
// numbers don't shift between deploys.
const ANON_EMPLOYEE_IDS: readonly string[] = Array.from(
  { length: 46 },
  (_, i) => `00000000-0000-0000-0000-000000${String(i + 2).padStart(6, '0')}`,
);

// Demo enrolment headcount for Crown Pub Group. Higher than the 47
// employees who actually transferred this month so the active-workforce
// percentage reads as a realistic ~81%, not 100%.
// Production should query the employee_accounts table for this.
export const DEMO_CROWN_ENROLMENT_COUNT = 58;

function seedAnonymousEmployerTransfers(target: EwaTransfer[]): void {
  const periodStart = new Date(Date.UTC(2026, 4, 1));
  const periodEnd = new Date(Date.UTC(2026, 4, 31, 23, 59, 59));
  const now = new Date(Date.UTC(2026, 4, 28, 9, 0, 0));

  // [daysAgo, amounts...] — amounts chosen to land on round-ish totals.
  const distribution: Array<[number, number[]]> = [
    // Last 7 days — drives the chart
    [6, [25, 40, 60]],
    [5, [20, 35, 50, 75, 30]],
    [4, [40, 55, 25, 80]],
    [3, [30, 45, 60, 25, 70, 35, 50, 40]],
    [2, [50, 70, 40, 60, 25, 80, 45, 55, 35, 65, 50, 70]],
    [1, [40, 30, 55, 25, 65, 45]],
    [0, [35, 50, 25, 40]],
    // Earlier in the pay period — drives monthly totals
    [9, [30, 50]],
    [12, [45, 25, 60]],
    [15, [40, 55]],
    [18, [30, 35, 70]],
    [21, [50]],
    [25, [35, 45, 40]],
  ];

  let employeeIdx = 0;
  let instantPattern = 0;
  for (const [daysAgo, amounts] of distribution) {
    for (const amount of amounts) {
      // Spread within the day deterministically so the chart timestamps
      // aren't all identical.
      const minuteOffset = (employeeIdx * 47) % (8 * 60);
      const initiatedAt = new Date(
        now.getTime() - daysAgo * 86400000 + minuteOffset * 60000,
      );
      // ~62% instant, ~38% standard — matches the 5:8 mix we want for
      // the fee-revenue stat.
      const isInstant = instantPattern % 8 < 5;
      instantPattern++;
      const feeAmount = isInstant ? 1.95 : 0;
      target.push({
        id: randomUUID(),
        employeeAccountId:
          ANON_EMPLOYEE_IDS[employeeIdx % ANON_EMPLOYEE_IDS.length],
        payPeriodStart: periodStart,
        payPeriodEnd: periodEnd,
        requestedAmount: amount,
        feeAmount,
        feeSubsidised: false,
        netAmount: amount,
        transferSpeed: isInstant ? 'instant' : 'standard',
        giftCardPartner: null,
        status: 'completed',
        bankAccountId: null,
        initiatedAt,
        completedAt: new Date(initiatedAt.getTime() + 60000),
        failureReason: null,
        fcaDisclosureShown: true,
        fcaDisclosureAt: initiatedAt,
        createdAt: initiatedAt,
      });
      employeeIdx++;
    }
  }
}

function seedJordanTransfers(target: EwaTransfer[]): void {
  // Pay period anchored to the mock May 2026 cycle so accessedAmount lines
  // up with /balance and /earnings summaries.
  const periodStart = new Date(Date.UTC(2026, 4, 1));
  const periodEnd = new Date(Date.UTC(2026, 4, 31, 23, 59, 59));
  const seeds: Array<{
    amount: number;
    speed: 'instant' | 'standard';
    daysAgo: number;
  }> = [
    { amount: 80, speed: 'instant', daysAgo: 2 },
    { amount: 50, speed: 'standard', daysAgo: 6 },
    { amount: 30, speed: 'instant', daysAgo: 10 },
  ];
  const now = new Date(Date.UTC(2026, 4, 28, 9, 0, 0));
  for (const s of seeds) {
    const initiatedAt = new Date(now.getTime() - s.daysAgo * 86400000);
    const completedAt = new Date(
      initiatedAt.getTime() + (s.speed === 'instant' ? 60000 : 2 * 86400000),
    );
    const feeAmount = s.speed === 'instant' ? 1.95 : 0;
    target.push({
      id: randomUUID(),
      employeeAccountId: JORDAN_ACCOUNT.id,
      payPeriodStart: periodStart,
      payPeriodEnd: periodEnd,
      requestedAmount: s.amount,
      feeAmount,
      feeSubsidised: feeAmount > 0,
      netAmount: s.amount,
      transferSpeed: s.speed,
      giftCardPartner: null,
      status: 'completed',
      bankAccountId: 'monzo-4891',
      initiatedAt,
      completedAt,
      failureReason: null,
      fcaDisclosureShown: true,
      fcaDisclosureAt: initiatedAt,
      createdAt: initiatedAt,
    });
  }
}

// Marcus's single £50 standard transfer earlier in the period — drives
// his accessedAmount = £50 and available = £155.92 (50% of £411.84 − £50).
function seedMarcusTransfers(target: EwaTransfer[]): void {
  const periodStart = new Date(Date.UTC(2026, 4, 1));
  const periodEnd = new Date(Date.UTC(2026, 4, 31, 23, 59, 59));
  const initiatedAt = new Date(Date.UTC(2026, 4, 15, 10, 30, 0));
  target.push({
    id: randomUUID(),
    employeeAccountId: MARCUS_ACCOUNT.id,
    payPeriodStart: periodStart,
    payPeriodEnd: periodEnd,
    requestedAmount: 50,
    feeAmount: 0,
    feeSubsidised: false,
    netAmount: 50,
    transferSpeed: 'standard',
    giftCardPartner: null,
    status: 'completed',
    bankAccountId: 'starling-3142',
    initiatedAt,
    completedAt: new Date(initiatedAt.getTime() + 2 * 86400000),
    failureReason: null,
    fcaDisclosureShown: true,
    fcaDisclosureAt: initiatedAt,
    createdAt: initiatedAt,
  });
}
