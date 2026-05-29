import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../../hooks/useApi';
import type { EmployerStats } from '../../types/api';
import { Icon } from '../shared/Icon';

const EMPLOYER_HEADERS = { 'x-fourth-employer-id': 'CROWN-PUB-GROUP' };

function fmtGbp(n: number | undefined): string {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  return '£' + (Number.isInteger(n) ? n.toLocaleString('en-GB') : n.toFixed(2));
}
function fmtGbpRounded(n: number | undefined): string {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  return '£' + Math.round(n).toLocaleString('en-GB');
}
function fmtPct(n: number | undefined): string {
  return typeof n === 'number' ? n.toFixed(1) + '%' : '—';
}
function weekdayShort(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
}
function dayOfMonth(iso: string): number {
  return parseInt(iso.slice(8, 10), 10);
}

export function EmployerDashboard() {
  const [stats, setStats] = useState<EmployerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>('just now');
  const [resetState, setResetState] = useState<{ status: '' | 'ok' | 'err'; msg: string; busy: boolean }>({
    status: '',
    msg: '',
    busy: false,
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(API_BASE + '/api/v1/employer/stats', { headers: EMPLOYER_HEADERS });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = (await res.json()) as EmployerStats;
      setStats(data);
      const now = new Date();
      setUpdatedAt(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Could not load stats: ${message}. Make sure the Fourth Pay API is reachable.`);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetDemo = async () => {
    setResetState({ status: '', msg: '', busy: true });
    try {
      const res = await fetch(API_BASE + '/api/v1/demo/reset', { method: 'POST' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      await load();
      setResetState({ status: 'ok', msg: '✓ Reset complete', busy: false });
      window.setTimeout(() => setResetState({ status: '', msg: '', busy: false }), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResetState({ status: 'err', msg: 'Reset failed: ' + message, busy: false });
    }
  };

  const chartMax = Math.max(...(stats?.daily_access_amounts.map((p) => p.amount) ?? [1]), 1);
  const chartTotal = stats?.daily_access_amounts.reduce((s, p) => s + p.amount, 0) ?? 0;

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <div className="brand-name">Fourth Pay · Employer portal</div>
            <div className="brand-sub">Crown Pub Group</div>
          </div>
        </div>
        <div className="topbar-right">
          <span>
            Updated <span>{updatedAt}</span>
          </span>
          <span className="role-chip">HR / Manager view</span>
        </div>
      </div>
      <main>
        <div className="page-head">
          <div className="page-title">This month at a glance</div>
          <div className="page-sub">Anonymised aggregate usage of Earned Wage Access across your workforce.</div>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="metrics">
          <Metric label="Employees enrolled" value={stats ? stats.total_employees_enrolled.toLocaleString('en-GB') : '—'} sub="Eligible workers signed up to Fourth Pay" />
          <Metric label="Active this month" value={fmtPct(stats?.percent_of_workforce_active)} sub="Share of enrolled workforce who used the service" teal />
          <Metric label="Transfers this month" value={stats ? stats.total_transfers_this_month.toLocaleString('en-GB') : '—'} sub="Completed pay-access transfers" />
          <Metric label="Total accessed" value={fmtGbpRounded(stats?.total_amount_accessed_this_month)} sub="Gross earned wages drawn early this month" teal />
          <Metric label="Average transfer" value={fmtGbp(stats?.average_transfer_amount)} sub="Mean amount per transfer this month" />
          <Metric label="Instant transfer fees" value={fmtGbp(stats?.fee_revenue_this_month)} sub="Total £1.95 fees on instant transfers" orange />
        </div>

        <div className="chart-card">
          <div className="chart-head">
            <div>
              <div className="chart-title">Daily access amounts</div>
              <div className="chart-sub">Last 7 days, all employees</div>
            </div>
            <div className="chart-sub">Week total: {fmtGbpRounded(chartTotal)}</div>
          </div>
          <div className="chart">
            {stats?.daily_access_amounts.map((p) => {
              const heightPct = Math.max(2, (p.amount / chartMax) * 100);
              return (
                <div key={p.date} className="bar-col">
                  <div className="bar-value">{fmtGbpRounded(p.amount)}</div>
                  <div className="bar-wrap">
                    <div className="bar" style={{ height: heightPct + '%' }} />
                  </div>
                  <div className="bar-label">{weekdayShort(p.date)}</div>
                  <div className="bar-day">{dayOfMonth(p.date)} May</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="footer-note">
          <Icon name="info" size={18} />
          <div>
            <strong>Anonymisation:</strong> all figures are workforce-level aggregates. Individual employee transfer data is never accessible to employers — see Fourth Pay's FCA Consumer Duty implementation.
          </div>
        </div>

        <div className="demo-tools">
          <div>
            <div className="demo-tools-label">Demo controls</div>
            <div className="demo-tools-desc" style={{ marginTop: 4 }}>
              Restore Jordan's and Marcus's starting balances, transfers, notifications, and self-controls to the original seed state.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={'reset-status' + (resetState.status === 'err' ? ' error' : '')}>{resetState.msg}</span>
            <button className="reset-btn" onClick={resetDemo} disabled={resetState.busy}>
              {resetState.busy ? 'Resetting…' : 'Reset demo data'}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

interface MetricProps {
  label: string;
  value: string;
  sub: string;
  teal?: boolean;
  orange?: boolean;
}
function Metric({ label, value, sub, teal, orange }: MetricProps) {
  const cls = 'metric' + (teal ? ' teal' : orange ? ' orange' : '');
  return (
    <div className={cls}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  );
}
