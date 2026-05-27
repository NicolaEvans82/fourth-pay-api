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
      feeSubsidised: row.fee_subsidised,
      minTenureDays: row.min_tenure_days,
      enabled: row.enabled,
      payrollLockdownStartDay: row.payroll_lockdown_start_day,
      payrollLockdownEndDay: row.payroll_lockdown_end_day,
    };
  }
}
