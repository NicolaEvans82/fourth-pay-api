import { useEffect, useState } from 'react';
import { useApi, useApiClient } from '../../hooks/useApi';
import { useScreenNav } from '../../hooks/useNavigate';
import { fmtGbp } from '../../format';
import type { BalanceResponse, SelfControls } from '../../types/api';
import { BackHeader } from '../shared/BackHeader';
import { Icon } from '../shared/Icon';

const COOLDOWN_OPTIONS = [
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '7 days', hours: 168 },
];

export function SelfControlsScreen() {
  const { go } = useScreenNav();
  const apiClient = useApiClient();
  const [refreshKey, setRefreshKey] = useState(0);
  const sc = useApi<SelfControls>('/api/v1/self-controls', refreshKey);
  const bal = useApi<BalanceResponse>('/api/v1/ewa/balance', refreshKey);

  // Local optimistic copies so toggles and sliders feel snappy.
  const [local, setLocal] = useState<SelfControls | null>(null);
  useEffect(() => {
    if (sc.data) setLocal(sc.data);
  }, [sc.data]);

  if (!local) {
    return (
      <div className="screen active">
        <BackHeader title="Self-controls" />
        <div className="controls-body">
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Loading…</div>
        </div>
      </div>
    );
  }

  const put = async (patch: Partial<SelfControls>) => {
    setLocal((l) => (l ? { ...l, ...patch } : l));
    const res = await apiClient<SelfControls>('PUT', '/api/v1/self-controls', patch);
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn('self-controls PUT failed:', res.error);
    }
    if ('monthlyLimitAmount' in patch || 'monthlyLimitEnabled' in patch) {
      setRefreshKey((k) => k + 1);
    }
  };

  const used = bal.data?.accessedAmount ?? 0;
  const cap = local.monthlyLimitAmount ?? 200;
  const heroPct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;

  return (
    <div className="screen active">
      <BackHeader title="Self-controls" />
      <div className="controls-body">
        <div className="controls-hero">
          <div className="controls-hero-label">This month's usage</div>
          <div className="controls-hero-val">
            {fmtGbp(used)} of {fmtGbp(cap)} limit
          </div>
          <div className="controls-hero-sub">{heroPct}% of your monthly cap</div>
          <div className="prog-track" style={{ marginTop: 12 }}>
            <div className="prog-fill" style={{ width: heroPct + '%', background: 'var(--orange)' }} />
          </div>
        </div>

        <ControlCard
          title="Monthly access limit"
          sub="Cap total per pay period"
          enabled={local.monthlyLimitEnabled}
          onToggle={() => put({ monthlyLimitEnabled: !local.monthlyLimitEnabled })}
        >
          <SliderRow
            label="Monthly cap"
            value={local.monthlyLimitAmount ?? 200}
            min={50}
            max={312}
            step={10}
            formatValue={(v) => `£${v}`}
            onChange={(v) => setLocal((l) => (l ? { ...l, monthlyLimitAmount: v } : l))}
            onCommit={(v) => put({ monthlyLimitAmount: v })}
            rangeLabels={['£50', '£312 (50% max)']}
          />
        </ControlCard>

        <ControlCard
          title="Per-transfer limit"
          sub="Maximum single transaction"
          enabled={local.perTransferLimitEnabled}
          onToggle={() => put({ perTransferLimitEnabled: !local.perTransferLimitEnabled })}
        >
          <SliderRow
            label="Max per transfer"
            value={local.perTransferLimitAmount ?? 100}
            min={10}
            max={312}
            step={10}
            formatValue={(v) => `£${v}`}
            onChange={(v) => setLocal((l) => (l ? { ...l, perTransferLimitAmount: v } : l))}
            onCommit={(v) => put({ perTransferLimitAmount: v })}
            rangeLabels={['£10', '£312']}
          />
        </ControlCard>

        <ControlCard
          title="Cooling-off period"
          sub="Minimum time between transfers"
          enabled={local.coolingOffEnabled}
          onToggle={() => put({ coolingOffEnabled: !local.coolingOffEnabled })}
        >
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>Minimum wait between transfers</div>
          <div className="cooldown-opts">
            {COOLDOWN_OPTIONS.map((opt) => (
              <div
                key={opt.label}
                className={'cooldown-opt' + (local.coolingOffHours === opt.hours ? ' active' : '')}
                onClick={() => put({ coolingOffHours: opt.hours })}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </ControlCard>

        <ControlCard
          title="Auto-save on access"
          sub="Save a % each time you access pay"
          enabled={local.autoSaveEnabled}
          onToggle={() => put({ autoSaveEnabled: !local.autoSaveEnabled })}
        >
          <SliderRow
            label="Auto-save rate"
            value={local.autoSavePercent ?? 10}
            min={5}
            max={30}
            step={5}
            formatValue={(v) => `${v}%`}
            onChange={(v) => setLocal((l) => (l ? { ...l, autoSavePercent: v } : l))}
            onCommit={(v) => put({ autoSavePercent: v })}
            rangeLabels={['5%', '30%']}
          />
        </ControlCard>

        <ControlCard
          title="Wellbeing nudges"
          sub="Helpful alerts when usage is high"
          enabled={local.wellbeingNudgesEnabled}
          onToggle={() => put({ wellbeingNudgesEnabled: !local.wellbeingNudgesEnabled })}
        />

        <button className="btn btn-danger-ghost" style={{ marginBottom: 10 }}>
          <Icon name="pause" /> Pause all access for 30 days
        </button>
        <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginBottom: 16 }}>
          Your limits are yours to set. Changes take effect immediately.{' '}
          <span style={{ color: 'var(--teal)', fontWeight: 700, cursor: 'pointer' }} onClick={() => go('coach')}>
            Talk to a money coach
          </span>{' '}
          if you need support.
        </p>
      </div>
    </div>
  );
}

interface ControlCardProps {
  title: string;
  sub: string;
  enabled: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}
function ControlCard({ title, sub, enabled, onToggle, children }: ControlCardProps) {
  return (
    <div className="control-card">
      <div className="control-header">
        <div>
          <div className="control-title">{title}</div>
          <div className="control-sub">{sub}</div>
        </div>
        <div className={'toggle ' + (enabled ? 'on' : 'off')} onClick={onToggle}>
          <div className="toggle-thumb" />
        </div>
      </div>
      {enabled && children && <div className="ctrl-slider-wrap">{children}</div>}
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue: (v: number) => string;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
  rangeLabels: [string, string];
}
function SliderRow({ label, value, min, max, step, formatValue, onChange, onCommit, rangeLabels }: SliderProps) {
  return (
    <>
      <div className="ctrl-slider-label">
        <span>{label}</span>
        <span>{formatValue(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        onMouseUp={(e) => onCommit(parseInt((e.currentTarget as HTMLInputElement).value, 10))}
        onTouchEnd={(e) => onCommit(parseInt((e.currentTarget as HTMLInputElement).value, 10))}
      />
      <div className="ctrl-range-labels">
        <span>{rangeLabels[0]}</span>
        <span>{rangeLabels[1]}</span>
      </div>
    </>
  );
}
