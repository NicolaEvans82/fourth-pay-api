import { useApi } from '../../hooks/useApi';
import { fmtGbp, fmtMonth, fmtPeriod } from '../../format';
import type { EarningsResponse } from '../../types/api';
import { BackHeader } from '../shared/BackHeader';
import { EarningsShiftCard } from '../shared/ShiftCard';

export function EarningsScreen() {
  const { data } = useApi<EarningsResponse>('/api/v1/ewa/earnings');
  return (
    <div className="screen active">
      <BackHeader title="Earnings tracker" />
      <div className="track-body">
        <div className="period-card">
          <div className="period-top">
            <div className="section-title" style={{ fontSize: 13 }}>
              {data ? fmtMonth(data.payPeriodStart) : 'This period'}
            </div>
            <div className="badge badge-teal">In progress</div>
          </div>
          <div className="period-dates">
            {data ? fmtPeriod(data.payPeriodStart, data.payPeriodEnd) : '—'} · Pay day 6 Jun
          </div>
          <div className="stats-grid">
            <div className="stat">
              <div className="stat-val">{fmtGbp(data?.summary.grossEarned ?? null)}</div>
              <div className="stat-label">Earned</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{ color: 'var(--teal)' }}>
                {fmtGbp(data?.summary.availableAmount ?? null)}
              </div>
              <div className="stat-label">Available</div>
            </div>
            <div className="stat">
              <div className="stat-val">{fmtGbp(data?.summary.accessedAmount ?? null)}</div>
              <div className="stat-label">Accessed</div>
            </div>
          </div>
        </div>
        <div className="section-title" style={{ padding: '0 0 10px', fontSize: 13 }}>
          Shifts this period
        </div>
        <div>
          {data?.shifts && data.shifts.length > 0 ? (
            data.shifts.map((s, i) => <EarningsShiftCard key={i} shift={s} />)
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
              {data ? 'No shifts in this period yet' : 'Loading…'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
