import { useApi } from '../../hooks/useApi';
import { useScreenNav } from '../../hooks/useNavigate';
import type { WellbeingComponent, WellbeingResponse } from '../../types/api';
import { BackHeader } from '../shared/BackHeader';
import { Icon } from '../shared/Icon';

const BAND_LABELS: Record<WellbeingResponse['band'], string> = {
  thriving: 'Thriving · keep it going',
  steady: 'Steady · building good habits',
  building: 'Building · small steps add up',
};

const COMPONENT_LABELS: Record<string, string> = {
  savings: 'Savings progress',
  monthlyLimit: 'Monthly limit usage',
  transferFrequency: 'Transfer frequency',
  coolingOff: 'Cooling-off period',
};

export function WellbeingScreen() {
  const { go } = useScreenNav();
  const { data } = useApi<WellbeingResponse>('/api/v1/wellbeing/score');
  const r = 32;
  const circumference = 2 * Math.PI * r;
  const dashOffset = data ? circumference * (1 - data.score / 100) : circumference * 0.27;

  return (
    <div className="screen active">
      <BackHeader title="Financial wellbeing" />
      <div className="wellbeing-body">
        <div className="score-card">
          <div className="score-label">Wellbeing score</div>
          <div className="score-row">
            <div>
              <div className="score-value">
                {data?.score ?? '—'}
                <span className="score-max">/100</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                {data ? BAND_LABELS[data.band] : 'Loading…'}
              </div>
            </div>
            <div className="score-ring">
              <svg viewBox="0 0 72 72">
                <circle className="score-track" cx="36" cy="36" r="32" />
                <circle
                  className="score-fill"
                  cx="36"
                  cy="36"
                  r="32"
                  style={{
                    strokeDasharray: circumference.toFixed(2),
                    strokeDashoffset: dashOffset.toFixed(2),
                  }}
                />
              </svg>
            </div>
          </div>
        </div>
        <div className="section-title" style={{ padding: '0 0 10px' }}>
          What's driving your score
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {data?.components &&
            (['savings', 'monthlyLimit', 'transferFrequency', 'coolingOff'] as const)
              .filter((k) => data.components[k])
              .map((k) => <Component key={k} k={k} c={data.components[k]!} />)}
        </div>
        <div className="section-title" style={{ padding: '0 0 10px' }}>
          Insights
        </div>
        <Insight icon="💡" title="£1,240/year in unclaimed benefits" body="Based on your profile, you may be entitled to Working Tax Credit, Council Tax Support, and more." cta="Check now →" onCta={() => go('benefits')} />
        <Insight icon="🎯" title="Holiday pot on track" body="At your current save rate you'll hit your £500 holiday goal by October 2026. Keep going!" cta="View pot →" onCta={() => go('save')} />
        <Insight icon="🏦" title="Lost pension found" body="We found a £11,580 deferred pot from Mitchells & Butlers. You could consolidate it now to grow it faster." cta="View pension →" onCta={() => go('pension')} />
        <Insight icon="📚" title="Your learning plan: 50% done" body='Next up: "How to budget on a shift-based income" — a 5-minute guide built for people with variable hours.' cta="Continue learning →" onCta={() => go('learn')} />
        <button className="btn btn-navy" style={{ marginTop: 6 }} onClick={() => go('coach')}>
          <Icon name="robot" /> Talk to your money coach
        </button>
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

function Component({ k, c }: { k: string; c: WellbeingComponent }) {
  const label = COMPONENT_LABELS[k] ?? k;
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Weight {Math.round(c.weight * 100)}%</div>
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-1)' }}>
          {c.score}<span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>/100</span>
        </div>
      </div>
      <div className="prog-track">
        <div className="prog-fill" style={{ width: c.score + '%', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{c.detail}</div>
    </div>
  );
}

function Insight({ icon, title, body, cta, onCta }: { icon: string; title: string; body: string; cta: string; onCta: () => void }) {
  return (
    <div className="insight-card">
      <div className="insight-header">
        <span>{icon}</span>
        <div className="insight-title">{title}</div>
      </div>
      <div className="insight-body">{body}</div>
      <span className="insight-action" onClick={onCta}>{cta}</span>
    </div>
  );
}
