import { useApi } from '../../hooks/useApi';
import { fmtGbp, fmtShortDate } from '../../format';
import type { ShiftsResponse } from '../../types/api';
import { BackHeader } from '../shared/BackHeader';
import { RecentShiftCard, UpcomingShiftCard } from '../shared/ShiftCard';

export function ShiftsScreen() {
  const { data } = useApi<ShiftsResponse>('/api/v1/shifts');
  const ws = data?.weeklySummary;
  const datesLabel = ws
    ? `${fmtShortDate(ws.weekStart)} – ${fmtShortDate(ws.weekEnd)} ${new Date(ws.weekEnd + 'T12:00:00Z').getUTCFullYear()}`
    : '—';
  return (
    <div className="screen active">
      <BackHeader title="Shifts" />
      <div className="track-body">
        <div className="period-card">
          <div className="period-top">
            <div className="section-title" style={{ fontSize: 13 }}>This week</div>
            <div className="badge badge-teal">In progress</div>
          </div>
          <div className="period-dates">{datesLabel}</div>
          <div className="stats-grid">
            <div className="stat">
              <div className="stat-val">{ws?.shiftCount ?? '—'}</div>
              <div className="stat-label">Shifts</div>
            </div>
            <div className="stat">
              <div className="stat-val">{ws ? ws.totalHours + 'h' : '—'}</div>
              <div className="stat-label">Hours</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{ color: 'var(--teal)' }}>
                {fmtGbp(ws?.totalEarnings ?? null)}
              </div>
              <div className="stat-label">Earnings</div>
            </div>
          </div>
        </div>

        <div className="section-title" style={{ padding: '0 0 10px', fontSize: 13 }}>
          Upcoming · next 7 days
        </div>
        <div>
          {data?.upcoming && data.upcoming.length > 0 ? (
            data.upcoming.map((s, i) => <UpcomingShiftCard key={i} shift={s} />)
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
              {data ? 'No shifts scheduled in the next 7 days' : 'Loading…'}
            </div>
          )}
        </div>

        <div className="section-title" style={{ padding: '14px 0 10px', fontSize: 13 }}>
          Recent · last 14 days
        </div>
        <div>
          {data?.recent && data.recent.length > 0 ? (
            data.recent.map((s, i) => <RecentShiftCard key={i} shift={s} />)
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
              {data ? 'No shifts in the last 14 days' : 'Loading…'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
