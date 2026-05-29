import { fmtGbp } from '../../format';
import { useScreenNav } from '../../hooks/useNavigate';
import type { BalanceResponse } from '../../types/api';

interface Props {
  data: BalanceResponse | null;
}

// The "This period" card on Home. Shows available / earned / next
// payday / weekly hours / monthly earnings, with the period progress
// bar at the bottom.
export function BalanceCard({ data }: Props) {
  const { go } = useScreenNav();
  const available = data?.availableAmount ?? 0;
  const earned = data?.earnedAmount ?? 0;
  const accessed = data?.accessedAmount ?? 0;
  const pct = earned > 0 ? Math.min(100, Math.max(0, (accessed / earned) * 100)) : 0;
  return (
    <div className="pay-card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--s4)',
        }}
      >
        <div>
          <div className="pay-card-label">This period</div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--teal-text)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginTop: 2,
            }}
          >
            Updated just now
          </div>
        </div>
        <button
          onClick={() => go('stream')}
          style={{
            background: 'var(--navy)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--r-sm)',
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          Get paid now →
        </button>
      </div>
      <div className="pay-card-meta" style={{ marginBottom: 'var(--s4)' }}>
        <div className="pay-meta-item">
          <div className="pay-meta-label">Available</div>
          <div
            className="pay-meta-val"
            style={{ fontSize: 20, letterSpacing: '-0.5px', color: 'var(--teal-text)' }}
          >
            {fmtGbp(available)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
            of {fmtGbp(earned)} earned · {fmtGbp(accessed)} used
          </div>
        </div>
        <div className="pay-meta-item">
          <div className="pay-meta-label">Next payday</div>
          <div className="pay-meta-val" style={{ fontSize: 20, letterSpacing: '-0.5px' }}>
            10 days
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>6 Jun 2026</div>
        </div>
        <div className="pay-meta-item">
          <div className="pay-meta-label">This week</div>
          <div className="pay-meta-val" style={{ fontSize: 20, letterSpacing: '-0.5px' }}>
            24h
          </div>
          <div style={{ fontSize: 10, color: 'var(--teal-text)', fontWeight: 600, marginTop: 1 }}>
            +8% vs last week
          </div>
        </div>
        <div className="pay-meta-item">
          <div className="pay-meta-label">This month</div>
          <div className="pay-meta-val" style={{ fontSize: 20, letterSpacing: '-0.5px' }}>
            {fmtGbp(earned)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--teal-text)', fontWeight: 600, marginTop: 1 }}>
            +15% vs last month
          </div>
        </div>
      </div>
      <div>
        <div className="prog-label">
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)' }}>
            Pay cycle · Day 17 of 31
          </span>
          <span style={{ fontSize: 11, color: 'var(--teal-text)', fontWeight: 700 }}>
            {fmtGbp(accessed)} accessed
          </span>
        </div>
        <div className="prog-track" style={{ marginTop: 4 }}>
          <div
            className="prog-fill"
            style={{ width: `${pct.toFixed(1)}%`, transition: 'width 0.4s ease' }}
          />
        </div>
      </div>
    </div>
  );
}
