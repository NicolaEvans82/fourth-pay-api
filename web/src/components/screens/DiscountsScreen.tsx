import { useApi } from '../../hooks/useApi';
import type { Discount, DiscountsResponse } from '../../types/api';
import { BackHeader } from '../shared/BackHeader';
import { Icon } from '../shared/Icon';

export function DiscountsScreen() {
  const { data } = useApi<DiscountsResponse>('/api/v1/discounts');
  return (
    <div className="screen active">
      <BackHeader title="Discounts & perks" />
      <div style={{ padding: 16 }}>
        {data?.employerPerks && data.employerPerks.length > 0 && (
          <>
            <div
              style={{
                fontFamily: 'var(--font)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--text-1)',
                margin: '0 0 10px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              The Crown Pub Group staff perks
            </div>
            <div className="activity-list" style={{ marginBottom: 18, padding: 0 }}>
              {data.employerPerks.map((p, i) => (
                <div key={i} className="activity-item">
                  <div
                    className="a-icon"
                    style={{ background: 'var(--navy)', color: 'white', fontWeight: 800, fontSize: 14 }}
                  >
                    🌟
                  </div>
                  <div className="a-body">
                    <div className="a-title">{p.name}</div>
                    <div className="a-date">{p.description}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--teal-text)' }}>{p.value}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {data ? (
          data.categories.map((c) => (
            <div key={c.name}>
              <div
                style={{
                  fontFamily: 'var(--font)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-1)',
                  margin: '0 0 10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {c.name}
              </div>
              <div className="activity-list" style={{ marginBottom: 18, padding: 0 }}>
                {c.discounts.map((d, i) => (
                  <DiscountRow key={i} d={d} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Loading…</div>
        )}
      </div>
    </div>
  );
}

function DiscountRow({ d }: { d: Discount }) {
  const right =
    d.redemption === 'code' && d.code ? (
      <div style={{ fontSize: 11, color: 'var(--teal-text)', fontWeight: 700, fontFamily: 'monospace' }}>{d.code}</div>
    ) : d.redemption === 'in-app' ? (
      <div style={{ fontSize: 11, color: 'var(--teal-text)', fontWeight: 700 }}>In-app</div>
    ) : (
      <Icon name="chevronR" size={18} color="var(--text-3)" />
    );
  return (
    <div className="activity-item">
      <div
        className="a-icon"
        style={{
          background: d.accentBg ?? 'var(--navy-deep)',
          color: d.accentFg ?? 'white',
          fontWeight: 800,
          fontSize: 11,
          letterSpacing: '-0.3px',
        }}
      >
        {(d.name ?? '').slice(0, 4)}
      </div>
      <div className="a-body">
        <div className="a-title">{d.name}</div>
        <div className="a-date">{d.description}</div>
      </div>
      <div>{right}</div>
    </div>
  );
}
