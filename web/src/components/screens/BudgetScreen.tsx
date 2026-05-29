import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useScreenNav } from '../../hooks/useNavigate';
import { fmtGbpInt, fmtMonthShort } from '../../format';
import type { BudgetEnvelope, BudgetResponse } from '../../types/api';
import { BackHeader } from '../shared/BackHeader';
import { Icon } from '../shared/Icon';

type Method = '5030' | 'zero' | 'custom';

// Visualization-only category breakdown — the API returns three
// envelopes (needs, wants, savings), and below those we still show
// the rich per-category 5030 breakdown from the prototype.
const STATIC_CATS = [
  { icon: '🏠', name: 'Rent & bills',  budget: 500, spent: 380, color: '#002747' },
  { icon: '🛒', name: 'Groceries',     budget: 250, spent: 214, color: '#00B69F' },
  { icon: '🍽️', name: 'Eating out',    budget: 80,  spent: 96,  color: '#e24b4a' },
  { icon: '🚌', name: 'Transport',     budget: 70,  spent: 58,  color: '#8b5cf6' },
  { icon: '🎮', name: 'Entertainment', budget: 80,  spent: 98,  color: '#FAA51A' },
  { icon: '💊', name: 'Health',        budget: 30,  spent: 0,   color: '#00937f' },
];

export function BudgetScreen() {
  const { go } = useScreenNav();
  const { data } = useApi<BudgetResponse>('/api/v1/budget');
  const [method, setMethod] = useState<Method>('5030');

  const usedFromApi = data ? data.needs.used + data.wants.used + data.savings.used : 0;
  const earningsFromApi = data?.monthlyEarnings ?? 0;
  const leftFromApi = earningsFromApi - usedFromApi;
  const pctFromApi = earningsFromApi > 0 ? Math.min(100, (usedFromApi / earningsFromApi) * 100) : 0;

  return (
    <div className="screen active">
      <BackHeader title="Budget planner" />
      <div style={{ flex: 1, padding: 16 }}>
        <div style={{ background: 'var(--navy-deep)', borderRadius: 'var(--r-lg)', padding: 20, marginBottom: 16, color: 'white' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 6 }}>
            {data ? `${fmtMonthShort(data.payPeriodStart)} budget` : 'This period'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
            <BudgetStat label="Earned" value={fmtGbpInt(earningsFromApi)} color="white" />
            <BudgetStat label="Used" value={fmtGbpInt(usedFromApi)} color="var(--orange)" />
            <BudgetStat label="Left" value={fmtGbpInt(leftFromApi)} color="var(--teal)" />
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 100, height: 8, overflow: 'hidden' }}>
            <div style={{ width: pctFromApi.toFixed(1) + '%', height: '100%', borderRadius: 100, background: 'var(--orange)', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
            <span>{Math.round(pctFromApi)}% of budget used</span>
            <span>50/30/20 rule</span>
          </div>
        </div>

        <div style={{ fontFamily: 'var(--font)', fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 10 }}>
          Category budgets
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {data && (
            <>
              <ApiEnvelopeRow label="Needs (50%)" c={data.needs} accent="var(--orange)" />
              <ApiEnvelopeRow label="Wants (30%)" c={data.wants} accent="#8b5cf6" />
              <ApiEnvelopeRow label="Save / debt (20%)" c={data.savings} accent="var(--teal)" />
            </>
          )}
          {STATIC_CATS.map((c) => {
            const pct = Math.min(100, Math.round((c.spent / c.budget) * 100));
            const over = c.spent > c.budget;
            return (
              <div key={c.name} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{c.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{c.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: over ? 'var(--red)' : 'var(--text-1)' }}>£{c.spent}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>of £{c.budget}</div>
                  </div>
                </div>
                <div style={{ background: 'var(--bg-page)', borderRadius: 100, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: pct + '%', height: '100%', borderRadius: 100, background: over ? 'var(--red)' : c.color }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 3 }}>
                  <span style={{ color: over ? 'var(--red)' : 'var(--text-3)' }}>
                    {over ? `Over budget by £${c.spent - c.budget}` : `${pct}% used`}
                  </span>
                  <span style={{ color: 'var(--text-3)' }}>£{Math.max(0, c.budget - c.spent)} left</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontFamily: 'var(--font)', fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 10 }}>
          Budget method
        </div>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 16 }}>
          <MethodRow active={method === '5030'} onClick={() => setMethod('5030')} title="50 / 30 / 20 rule" sub="Needs · Wants · Save/debt" />
          <MethodRow active={method === 'zero'} onClick={() => setMethod('zero')} title="Zero-based budgeting" sub="Assign every pound a job" />
          <MethodRow active={method === 'custom'} onClick={() => setMethod('custom')} title="Custom" sub="Set your own category limits" last />
        </div>
        <button className="btn btn-teal" onClick={() => go('spend')}>
          <Icon name="eye" /> View spending breakdown
        </button>
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

function BudgetStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font)', fontSize: 17, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}
function ApiEnvelopeRow({ label, c, accent }: { label: string; c: BudgetEnvelope; accent: string }) {
  const pct = c.allocated > 0 ? Math.min(100, (c.used / c.allocated) * 100) : 0;
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>{fmtGbpInt(c.used)}</span> of {fmtGbpInt(c.allocated)}
        </div>
      </div>
      <div className="prog-track">
        <div className="prog-fill" style={{ width: pct.toFixed(1) + '%', background: accent, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{fmtGbpInt(c.remaining)} left</div>
    </div>
  );
}
function MethodRow({ active, onClick, title, sub, last }: { active: boolean; onClick: () => void; title: string; sub: string; last?: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '14px 16px',
        borderBottom: last ? undefined : '1px solid var(--border)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{sub}</div>
      </div>
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: '2px solid ' + (active ? 'var(--teal)' : 'var(--border)'),
          background: active ? 'var(--teal)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {active && <Icon name="check" size={11} color="white" />}
      </div>
    </div>
  );
}
