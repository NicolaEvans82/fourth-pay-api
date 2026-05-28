export interface UpcomingShift {
  date: string; // YYYY-MM-DD
  dayName: string; // 'Friday'
  startTime: string; // 'HH:MM' (UTC)
  endTime: string;
  hours: number;
  site: string | null;
  role: string | null;
}

export interface RecentShift {
  date: string;
  dayName: string;
  hours: number;
  earnings: number;
  elementType: string; // 'Basic Hours' | 'Overtime' | 'Bank Holiday' | ...
  site: string | null;
}

export interface WeeklySummary {
  weekStart: string; // ISO date of Monday
  weekEnd: string;
  totalHours: number;
  totalEarnings: number;
  shiftCount: number;
}

export interface ShiftsResponse {
  upcoming: UpcomingShift[];
  recent: RecentShift[];
  weeklySummary: WeeklySummary;
}
