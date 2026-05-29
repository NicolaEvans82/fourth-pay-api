import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './pg';
import type {
  EwaTransfer,
  EwaTransferReader,
  EwaTransferStatus,
  EwaTransferWriter,
  NewEwaTransfer,
} from './ewa-transfer.store';

// Pg-backed equivalent of InMemoryEwaTransferStore. Schema: see
// src/database/migrations/20260527000001_create_ewa_tables.ts.
//
// Decimal columns come back from pg as strings — coerced to number
// in toRow() / fromRow(). Production should consider a custom
// pg type parser instead of per-call parseFloat, but per-call keeps
// the boundary obvious.
@Injectable()
export class PgEwaTransferStore implements EwaTransferReader, EwaTransferWriter {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async sumAdvancesInPeriod(input: {
    employeeAccountId: string;
    payPeriodStart: Date;
  }): Promise<number> {
    const r = await this.pool.query<{ sum: string | null }>(
      `SELECT COALESCE(SUM(requested_amount), 0)::text AS sum
         FROM ewa_transfers
        WHERE employee_account_id = $1
          AND pay_period_start = $2
          AND status NOT IN ('failed', 'reversed')`,
      [input.employeeAccountId, isoDate(input.payPeriodStart)],
    );
    return parseFloat(r.rows[0]?.sum ?? '0');
  }

  async findRecentByEmployee(input: {
    employeeAccountId: string;
    limit: number;
    payPeriodStart?: Date;
  }): Promise<EwaTransfer[]> {
    const sql = input.payPeriodStart
      ? `SELECT * FROM ewa_transfers
          WHERE employee_account_id = $1
            AND pay_period_start = $2
          ORDER BY initiated_at DESC
          LIMIT $3`
      : `SELECT * FROM ewa_transfers
          WHERE employee_account_id = $1
          ORDER BY initiated_at DESC
          LIMIT $2`;
    const params = input.payPeriodStart
      ? [input.employeeAccountId, isoDate(input.payPeriodStart), input.limit]
      : [input.employeeAccountId, input.limit];
    const r = await this.pool.query<EwaTransferRow>(sql, params);
    return r.rows.map(fromRow);
  }

  async findLatestCompleted(
    employeeAccountId: string,
  ): Promise<EwaTransfer | null> {
    const r = await this.pool.query<EwaTransferRow>(
      `SELECT * FROM ewa_transfers
        WHERE employee_account_id = $1 AND status = 'completed'
        ORDER BY completed_at DESC NULLS LAST
        LIMIT 1`,
      [employeeAccountId],
    );
    return r.rows[0] ? fromRow(r.rows[0]) : null;
  }

  async listAll(): Promise<EwaTransfer[]> {
    const r = await this.pool.query<EwaTransferRow>(
      `SELECT * FROM ewa_transfers ORDER BY initiated_at DESC`,
    );
    return r.rows.map(fromRow);
  }

  async insert(input: NewEwaTransfer): Promise<EwaTransfer> {
    const r = await this.pool.query<EwaTransferRow>(
      `INSERT INTO ewa_transfers (
         employee_account_id, pay_period_start, pay_period_end,
         requested_amount, fee_amount, fee_subsidised, net_amount,
         transfer_speed, gift_card_partner, status, bank_account_id,
         fca_disclosure_shown, fca_disclosure_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11, $12
       )
       RETURNING *`,
      [
        input.employeeAccountId,
        isoDate(input.payPeriodStart),
        isoDate(input.payPeriodEnd),
        input.requestedAmount,
        input.feeAmount,
        input.feeSubsidised,
        input.netAmount,
        input.transferSpeed,
        input.giftCardPartner,
        input.bankAccountId,
        input.fcaDisclosureShown,
        input.fcaDisclosureAt,
      ],
    );
    return fromRow(r.rows[0]);
  }

  async setStatus(input: {
    id: string;
    status: EwaTransferStatus;
    completedAt?: Date;
    failureReason?: string;
  }): Promise<EwaTransfer> {
    const r = await this.pool.query<EwaTransferRow>(
      `UPDATE ewa_transfers
          SET status = $1,
              completed_at = COALESCE($2, completed_at),
              failure_reason = COALESCE($3, failure_reason)
        WHERE id = $4
        RETURNING *`,
      [
        input.status,
        input.completedAt ?? null,
        input.failureReason ?? null,
        input.id,
      ],
    );
    if (!r.rows[0]) {
      throw new Error(`EwaTransfer not found: ${input.id}`);
    }
    return fromRow(r.rows[0]);
  }
}

interface EwaTransferRow {
  id: string;
  employee_account_id: string;
  pay_period_start: Date;
  pay_period_end: Date;
  requested_amount: string;
  fee_amount: string;
  fee_subsidised: boolean;
  net_amount: string;
  transfer_speed: 'instant' | 'standard' | 'gift_card';
  // Optional column — production migration to land alongside the
  // gift_card transferSpeed rollout. Currently nullable in mock mode
  // (the Pg path isn't exercised on the demo Railway deploy).
  gift_card_partner: string | null;
  status: EwaTransferStatus;
  bank_account_id: string | null;
  initiated_at: Date;
  completed_at: Date | null;
  failure_reason: string | null;
  fca_disclosure_shown: boolean;
  fca_disclosure_at: Date | null;
  created_at: Date;
}

function fromRow(r: EwaTransferRow): EwaTransfer {
  return {
    id: r.id,
    employeeAccountId: r.employee_account_id,
    payPeriodStart: r.pay_period_start,
    payPeriodEnd: r.pay_period_end,
    requestedAmount: parseFloat(r.requested_amount),
    feeAmount: parseFloat(r.fee_amount),
    feeSubsidised: r.fee_subsidised,
    netAmount: parseFloat(r.net_amount),
    transferSpeed: r.transfer_speed,
    giftCardPartner: r.gift_card_partner ?? null,
    status: r.status,
    bankAccountId: r.bank_account_id,
    initiatedAt: r.initiated_at,
    completedAt: r.completed_at,
    failureReason: r.failure_reason,
    fcaDisclosureShown: r.fca_disclosure_shown,
    fcaDisclosureAt: r.fca_disclosure_at,
    createdAt: r.created_at,
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
