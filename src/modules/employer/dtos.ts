import { IsIn, IsInt } from 'class-validator';

export interface DailyAccessPoint {
  date: string; // ISO YYYY-MM-DD
  amount: number;
}

export interface EmployerStatsResponse {
  employer_id: string;
  total_employees_enrolled: number;
  total_transfers_this_month: number;
  total_amount_accessed_this_month: number;
  average_transfer_amount: number;
  fee_revenue_this_month: number;
  percent_of_workforce_active: number;
  daily_access_amounts: DailyAccessPoint[];
}

// PATCH /api/v1/employer/config — Pay access settings surface only
// allows the three discrete pills (50/60/70). Anything else is 400.
// Production should add audit_log + role check (CLAUDE.md rule 6).
export class UpdateEmployerConfigBody {
  @IsInt()
  @IsIn([50, 60, 70])
  access_cap_percent!: number;
}

export interface EmployerConfigResponse {
  employer_id: string;
  access_cap_percent: number;
}
