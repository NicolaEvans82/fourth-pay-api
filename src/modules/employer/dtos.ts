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
