import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import {
  EmployerConfig,
  EmployerConfigReader,
} from '../../integrations/hr/hr.adapter';
import { PG_POOL } from '../pg';

interface EmployerConfigRow {
  fourth_employer_id: string;
  max_access_percent: number;
  // Default 50 in the column definition; the migration to add this
  // column lands when production needs it (mock mode bypasses
  // entirely). Falls back to 50 if the column doesn't exist yet.
  access_cap_percent: number | null;
  fee_subsidised: boolean;
  min_tenure_days: number;
  enabled: boolean;
  payroll_lockdown_start_day: number;
  payroll_lockdown_end_day: number;
}

@Injectable()
export class PgEmployerConfigReader implements EmployerConfigReader {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByFourthEmployerId(
    fourthEmployerId: string,
  ): Promise<EmployerConfig | null> {
    const result = await this.pool.query<EmployerConfigRow>(
      `SELECT
         fourth_employer_id,
         max_access_percent,
         access_cap_percent,
         fee_subsidised,
         min_tenure_days,
         enabled,
         payroll_lockdown_start_day,
         payroll_lockdown_end_day
       FROM employer_config
       WHERE fourth_employer_id = $1`,
      [fourthEmployerId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      fourthEmployerId: row.fourth_employer_id,
      maxAccessPercent: row.max_access_percent,
      accessCapPercent: row.access_cap_percent ?? 50,
      feeSubsidised: row.fee_subsidised,
      minTenureDays: row.min_tenure_days,
      enabled: row.enabled,
      payrollLockdownStartDay: row.payroll_lockdown_start_day,
      payrollLockdownEndDay: row.payroll_lockdown_end_day,
    };
  }
}
