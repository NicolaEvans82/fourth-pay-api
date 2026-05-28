import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './pg';
import type {
  SelfControlsReader,
  SelfControlsRecord,
} from './readers/self-controls.reader';
import type { SelfControlsWriter } from './writers/self-controls.writer';

@Injectable()
export class PgSelfControlsStore
  implements SelfControlsReader, SelfControlsWriter
{
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByEmployeeAccountId(
    employeeAccountId: string,
  ): Promise<SelfControlsRecord | null> {
    const r = await this.pool.query<SelfControlsRow>(
      `SELECT * FROM self_controls WHERE employee_account_id = $1`,
      [employeeAccountId],
    );
    return r.rows[0] ? fromRow(r.rows[0]) : null;
  }

  async upsert(record: SelfControlsRecord): Promise<SelfControlsRecord> {
    const r = await this.pool.query<SelfControlsRow>(
      `INSERT INTO self_controls (
         employee_account_id,
         monthly_limit_enabled, monthly_limit_amount,
         per_transfer_limit_enabled, per_transfer_limit_amount,
         cooling_off_enabled, cooling_off_hours,
         auto_save_enabled, auto_save_percent,
         wellbeing_nudges_enabled, paused_until, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
       )
       ON CONFLICT (employee_account_id) DO UPDATE SET
         monthly_limit_enabled      = EXCLUDED.monthly_limit_enabled,
         monthly_limit_amount       = EXCLUDED.monthly_limit_amount,
         per_transfer_limit_enabled = EXCLUDED.per_transfer_limit_enabled,
         per_transfer_limit_amount  = EXCLUDED.per_transfer_limit_amount,
         cooling_off_enabled        = EXCLUDED.cooling_off_enabled,
         cooling_off_hours          = EXCLUDED.cooling_off_hours,
         auto_save_enabled          = EXCLUDED.auto_save_enabled,
         auto_save_percent          = EXCLUDED.auto_save_percent,
         wellbeing_nudges_enabled   = EXCLUDED.wellbeing_nudges_enabled,
         paused_until               = EXCLUDED.paused_until,
         updated_at                 = NOW()
       RETURNING *`,
      [
        record.employeeAccountId,
        record.monthlyLimitEnabled,
        record.monthlyLimitAmount,
        record.perTransferLimitEnabled,
        record.perTransferLimitAmount,
        record.coolingOffEnabled,
        record.coolingOffHours,
        record.autoSaveEnabled,
        record.autoSavePercent,
        record.wellbeingNudgesEnabled,
        record.pausedUntil,
      ],
    );
    return fromRow(r.rows[0]);
  }
}

interface SelfControlsRow {
  employee_account_id: string;
  monthly_limit_enabled: boolean;
  monthly_limit_amount: string | null;
  per_transfer_limit_enabled: boolean;
  per_transfer_limit_amount: string | null;
  cooling_off_enabled: boolean;
  cooling_off_hours: number;
  auto_save_enabled: boolean;
  auto_save_percent: number;
  wellbeing_nudges_enabled: boolean;
  paused_until: Date | null;
}

function fromRow(r: SelfControlsRow): SelfControlsRecord {
  return {
    employeeAccountId: r.employee_account_id,
    monthlyLimitEnabled: r.monthly_limit_enabled,
    monthlyLimitAmount:
      r.monthly_limit_amount === null
        ? null
        : parseFloat(r.monthly_limit_amount),
    perTransferLimitEnabled: r.per_transfer_limit_enabled,
    perTransferLimitAmount:
      r.per_transfer_limit_amount === null
        ? null
        : parseFloat(r.per_transfer_limit_amount),
    coolingOffEnabled: r.cooling_off_enabled,
    coolingOffHours: r.cooling_off_hours,
    autoSaveEnabled: r.auto_save_enabled,
    autoSavePercent: r.auto_save_percent,
    wellbeingNudgesEnabled: r.wellbeing_nudges_enabled,
    pausedUntil: r.paused_until,
  };
}
