import { useState, type CSSProperties } from 'react';
import { BackHeader } from '../shared/BackHeader';
import { Icon } from '../shared/Icon';

// Spending uses static seed data — the real Open Banking connector
// isn't built yet (Spec 16/spending_tracker is UI-only). Faithful
// port of the existing markup.

const SPEND_BARS = [62, 78, 55, 82, 91, 74, 88, 95, 83, 70, 91, 84, 77, 65, 88, 92, 84, 76, 88, 95, 82, 74, 88, 95, 82, 74, 70];

const CATS = [
  { name: '🛒 Groceries',     amt: 214.30, pct: '68%', pctText: '25%', color: '#00b59e' },
  { name: '🏠 Rent & bills',  amt: 380.00, pct: '100%', pctText: '45%', color: '#002747' },
  { name: '🍽️ Eating out',    amt: 96.40, pct: '30%', pctText: '11%', color: '#FAA51A' },
  { name: '🚌 Transport',     amt: 58.50, pct: '18%', pctText: '7%',  color: '#8b5cf6' },
  { name: '🎮 Entertainment', amt: 98.00, pct: '32%', pctText: '12%', color: '#e24b4a' },
];

interface Bill {
  icon: string;
  iconBg: string;
  name: string;
  meta: string;
  amt: string;
  metaAmt: string;
  metaColor: string;
  barColor: string;
  barWidth: string;
  red?: boolean;
}

const INITIAL_BILLS: Bill[] = [
  { icon: '🏠', iconBg: '#e8f4fd',          name: 'Rent',          meta: 'Due 1 Jun · Monthly',  amt: '£650.00', metaAmt: '5 days away',  metaColor: 'var(--text-3)', barColor: 'var(--orange)', barWidth: '80%' },
  { icon: '⚡', iconBg: 'var(--teal-tint)',  name: 'Gas & electric',meta: 'Due 12 Jun · Monthly',amt: '£94.00',  metaAmt: '16 days away', metaColor: 'var(--teal)',   barColor: 'var(--teal)',   barWidth: '30%' },
  { icon: '📱', iconBg: '#f3e8ff',          name: 'Mobile phone',  meta: 'Due 15 Jun · Monthly',amt: '£28.00',  metaAmt: '19 days away', metaColor: 'var(--teal)',   barColor: 'var(--teal)',   barWidth: '15%' },
  { icon: '📺', iconBg: 'var(--red-tint)',  name: 'Internet',      meta: 'Due TODAY · Monthly', amt: '£32.00',  metaAmt: '⚠️ Due now',   metaColor: 'var(--red-text)',barColor: 'var(--red)',    barWidth: '100%', red: true },
];

export function SpendingScreen() {
  const [bills, setBills] = useState<Bill[]>(INITIAL_BILLS);
  const max = Math.max(...SPEND_BARS);
  const addBill = () => {
    // eslint-disable-next-line no-alert
    const name = prompt('Bill name (e.g. Council Tax):');
    if (!name) return;
    // eslint-disable-next-line no-alert
    const amount = prompt('Monthly amount (£):');
    if (!amount) return;
    // eslint-disable-next-line no-alert
    const day = prompt('Due day of month (e.g. 1):');
    if (!day) return;
    setBills((b) => [
      ...b,
      {
        icon: '💳',
        iconBg: 'var(--orange-tint)',
        name,
        meta: `Due ${day} each month`,
        amt: '£' + parseFloat(amount).toFixed(2),
        metaAmt: '',
        metaColor: 'var(--text-3)',
        barColor: 'var(--teal)',
        barWidth: '50%',
      },
    ]);
  };

  return (
    <div className="screen active">
      <BackHeader title="Spending tracker" />
      <div className="spend-body">
        <div className="spend-hero">
          <div className="spend-hero-label">Total spent this month</div>
          <div className="spend-hero-amount">£847.20</div>
          <div className="spend-hero-sub">Across 2 linked accounts</div>
          <div className="bar-chart">
            {SPEND_BARS.map((v, i) => (
              <div key={i} className="bar-wrap">
                <div
                  className={'bar' + (i === SPEND_BARS.length - 1 ? ' active' : '')}
                  style={{ height: Math.round((v / max) * 72) + 'px' }}
                />
                <div className="bar-label">
                  {i % 7 === 0 ? ['1', '8', '15', '22', '27'][Math.floor(i / 7)] ?? '' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="section-header" style={{ padding: '16px 0 8px' }}>
          <div className="section-title">Linked accounts</div>
          <div className="section-link">+ Add account</div>
        </div>
        <div className="account-item">
          <div className="account-left">
            <div className="account-logo" style={{ background: 'var(--navy-deep)', color: 'white' }}>M</div>
            <div>
              <div className="account-name">Monzo</div>
              <div className="account-type">Current account</div>
            </div>
          </div>
          <div>
            <div className="account-bal">£1,243.80</div>
            <div className="account-change" style={{ color: 'var(--teal)' }}>+£312.50 today</div>
          </div>
        </div>
        <div className="account-item">
          <div className="account-left">
            <div className="account-logo" style={{ background: '#eb1801', color: 'white' }}>S</div>
            <div>
              <div className="account-name">Santander</div>
              <div className="account-type">Savings account</div>
            </div>
          </div>
          <div>
            <div className="account-bal">£4,120.00</div>
            <div className="account-change" style={{ color: 'var(--text-3)' }}>4.5% AER</div>
          </div>
        </div>

        <div className="section-header" style={{ padding: '16px 0 8px' }}>
          <div className="section-title">Spending by category</div>
        </div>
        <div className="cat-list">
          {CATS.map((c) => (
            <div key={c.name} className="cat-item">
              <div className="cat-top">
                <span className="cat-name">{c.name}</span>
                <span className="cat-amt">£{c.amt.toFixed(2)}</span>
              </div>
              <div className="cat-bar-track">
                <div className="cat-bar-fill" style={{ width: c.pct, background: c.color }} />
              </div>
              <div className="cat-pct">{c.pctText} of spending</div>
            </div>
          ))}
        </div>

        <div className="section-header" style={{ padding: '16px 0 8px' }}>
          <div className="section-title">Bill reminders</div>
          <div className="section-link" onClick={addBill}>+ Add bill</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {bills.map((b, i) => (
            <BillCard key={i} bill={b} />
          ))}
        </div>

        <div
          style={{
            background: 'var(--bg-page)',
            borderRadius: 'var(--r-sm)',
            padding: '12px 14px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Icon name="bell" size={18} color="var(--teal)" />
          <div style={{ flex: 1, fontSize: 12, color: 'var(--text-3)' }}>
            Bill reminders are sent 3 days before each due date.{' '}
            <span style={{ color: 'var(--teal)', fontWeight: 700 }}>Change reminder timing →</span>
          </div>
        </div>
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

function BillCard({ bill }: { bill: Bill }) {
  const outerStyle: CSSProperties = bill.red
    ? { border: '1px solid var(--red)', background: 'var(--red-tint)', flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: 0, overflow: 'hidden' }
    : { flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: 0, overflow: 'hidden' };
  return (
    <div className="account-item" style={outerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: bill.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0,
              border: bill.red ? '1px solid var(--red-border)' : undefined,
            }}
          >
            {bill.icon}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: bill.red ? 'var(--red-text)' : 'var(--text-1)' }}>{bill.name}</div>
            <div style={{ fontSize: 11, color: bill.red ? 'var(--red-text)' : 'var(--text-3)', opacity: bill.red ? 0.7 : 1 }}>{bill.meta}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: bill.red ? 'var(--red-text)' : 'var(--text-1)' }}>{bill.amt}</div>
          <div style={{ fontSize: 10, fontWeight: bill.red ? 700 : 400, color: bill.metaColor }}>{bill.metaAmt}</div>
        </div>
      </div>
      <div style={{ height: 3, background: bill.red ? 'var(--red)' : 'var(--bg-page)' }}>
        {!bill.red && (
          <div style={{ width: bill.barWidth, height: '100%', background: bill.barColor, borderRadius: '0 100px 100px 0' }} />
        )}
      </div>
    </div>
  );
}
