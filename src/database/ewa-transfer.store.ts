import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export const EWA_TRANSFER_READER = Symbol('EwaTransferReader');
export const EWA_TRANSFER_WRITER = Symbol('EwaTransferWriter');

export type EwaTransferStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'reversed';

export interface EwaTransfer {
  id: string;
  employeeAccountId: string;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  requestedAmount: number;
  feeAmount: number;
  feeSubsidised: boolean;
  netAmount: number;
  transferSpeed: 'instant' | 'standard';
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
  transferSpeed: 'instant' | 'standard';
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
  implements EwaTransferReader, EwaTransferWriter
{
  private readonly transfers: EwaTransfer[] = [];

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
