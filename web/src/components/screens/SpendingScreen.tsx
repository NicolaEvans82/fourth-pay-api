import { useApi } from '../../hooks/useApi';
import { fmtGbp, fmtGbpInt } from '../../format';
import type { SpendingCategory, SpendingResponse, SpendingTransaction } from '../../types/api';
import { BackHeader } from '../shared/BackHeader';
import { Icon } from '../shared/Icon';

// Maps category name → emoji for the transactions list. Falls back to
// a coin icon for any category the seed doesn't cover.
const CATEGORY_EMOJI: Record<string, string> = {
  Housing: '🏠',
  'Food and drink': '🛒',
  Transport: '🚌',
  Entertainment: '🎮',
  Shopping: '🛍️',
  'EWA accessed': '⚡',
  Savings: '💰',
  Other: '💳',
};

export function SpendingScreen() {
  const { data } = useApi<SpendingResponse>('/api/v1/spending');

  return (
    <div className="screen active">
      <BackHeader title="Spending tracker" />
      <div className="spend-body">
        <SummaryCard data={data} />
        <CategoryChart categories={data?.categories ?? []} total={data?.total_spent ?? 0} />
        <TransactionsList transactions={data?.transactions ?? []} loading={!data} />
        <ConnectBankCta />
        <Disclaimer text={data?.estimated_disclaimer ?? ''} />
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

function SummaryCard({ data }: { data: SpendingResponse | null }) {
  return (
    <div className="spend-hero">
      <div className="spend-hero-label">This period</div>
      <div className="spend-hero-amount">{fmtGbpInt(data?.total_spent ?? null)}</div>
      <div className="spend-hero-sub">
        Estimated spending of <strong>{fmtGbpInt(data?.total_income ?? null)}</strong> earned
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)',
          gap: 8,
          marginTop: 14,
          paddingTop: 14,
          borderTop: '1px solid var(--border)',
        }}
      >
        <SummaryStat label="Income" value={fmtGbpInt(data?.total_income ?? null)} color="var(--text-1)" />
        <SummaryStat label="Spent" value={fmtGbpInt(data?.total_spent ?? null)} color="var(--orange-text)" />
        <SummaryStat label="Remaining" value={fmtGbpInt(data?.remaining ?? null)} color="var(--teal-text)" />
      </div>
    </div>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color, letterSpacing: '-0.3px' }}>{value}</div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-3)',
          textTransform: 'uppercase',
          fontWeight: 700,
          letterSpacing: '0.4px',
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function CategoryChart({ categories, total }: { categories: SpendingCategory[]; total: number }) {
  // Pure CSS horizontal bar chart. Each row is a flex container:
  // a fixed-width label column, a flex-1 bar, and a right-aligned £
  // value. The bar width is the category's share of the largest
  // category (not total_spent) so the longest bar always hits 100%.
  const maxAmount = categories.reduce((m, c) => Math.max(m, c.amount), 1);
  const nonZero = categories.filter((c) => c.amount > 0);

  return (
    <>
      <div className="section-header" style={{ padding: '16px 0 8px' }}>
        <div className="section-title">Where it went</div>
      </div>
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          padding: 14,
          marginBottom: 16,
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {nonZero.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>
            Loading…
          </div>
        ) : (
          nonZero.map((c) => {
            const widthPct = (c.amount / maxAmount) * 100;
            const sharePct = total > 0 ? Math.round((c.amount / total) * 100) : 0;
            return (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-1)',
                    width: 92,
                    flexShrink: 0,
                  }}
                >
                  {c.name}
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <div
                    style={{
                      background: 'var(--bg-page)',
                      borderRadius: 100,
                      height: 8,
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div
                      style={{
                        width: widthPct + '%',
                        height: '100%',
                        background: c.color,
                        borderRadius: 100,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{sharePct}% of spend</div>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: 'var(--text-1)',
                    width: 56,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {fmtGbp(c.amount)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function TransactionsList({ transactions, loading }: { transactions: SpendingTransaction[]; loading: boolean }) {
  return (
    <>
      <div className="section-header" style={{ padding: '0 0 8px' }}>
        <div className="section-title">Recent transactions</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Loading…</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No transactions this period
          </div>
        ) : (
          transactions.map((t) => <TransactionRow key={t.id} t={t} />)
        )}
      </div>
    </>
  );
}

function TransactionRow({ t }: { t: SpendingTransaction }) {
  const ago = t.daysAgo === 0 ? 'Today' : t.daysAgo === 1 ? 'Yesterday' : `${t.daysAgo} days ago`;
  return (
    <div className="activity-item">
      <div className="a-icon" style={{ background: 'var(--bg-page)', fontSize: 17 }}>
        {CATEGORY_EMOJI[t.category] ?? '💳'}
      </div>
      <div className="a-body">
        <div className="a-title">{t.merchant}</div>
        <div className="a-date">
          {ago} · {t.category}
        </div>
      </div>
      <div className="a-amount" style={{ color: 'var(--text-1)' }}>
        −{fmtGbp(t.amount)}
      </div>
    </div>
  );
}

function ConnectBankCta() {
  // No real Open Banking connector yet — the button is intentionally
  // a soft CTA, not a working integration. Clicking surfaces a copy
  // explanation so users know it's coming.
  const onClick = () => {
    // eslint-disable-next-line no-alert
    alert(
      'Connect your bank — coming soon.\n\nWe’re building Open Banking integration so spending shows the real transactions from your current account, not estimates. Until then this view uses typical UK hospitality patterns based on your pay.',
    );
  };
  return (
    <div
      style={{
        background: 'var(--teal-tint)',
        border: '1px solid var(--teal-border)',
        borderRadius: 'var(--r-md)',
        padding: 14,
        marginBottom: 14,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="bank" size={18} color="var(--teal-text)" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal-text)' }}>Connect your bank for real spending</div>
        <div style={{ fontSize: 11, color: 'var(--teal-text)', opacity: 0.85, marginTop: 2 }}>
          Replace estimates with actual transactions via Open Banking
        </div>
      </div>
      <button
        onClick={onClick}
        style={{
          background: 'var(--navy)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--r-sm)',
          padding: '7px 12px',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'var(--font)',
          flexShrink: 0,
        }}
      >
        Connect →
      </button>
    </div>
  );
}

function Disclaimer({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5, fontStyle: 'italic', padding: '0 2px' }}>
      {text}
    </div>
  );
}
