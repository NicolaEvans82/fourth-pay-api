import { useApi } from '../../hooks/useApi';
import { fmtGbpInt } from '../../format';
import type { PensionResponse, PensionScenario } from '../../types/api';
import { BackHeader } from '../shared/BackHeader';

const STATUS_COPY: Record<PensionResponse['autoEnrolmentStatus'], string> = {
  enrolled: 'Enrolled — you and your employer are contributing',
  eligible: 'You meet the auto-enrolment criteria — opt in to start contributing',
  below_threshold: 'Below the £10,000 auto-enrolment threshold — you can opt in voluntarily',
  opted_out: 'Currently opted out — opt back in to resume contributions',
};

export function PensionScreen() {
  const { data } = useApi<PensionResponse>('/api/v1/pension');
  return (
    <div className="screen active">
      <BackHeader title="My pension" />
      <div className="pension-body">
        <div className="pension-hero">
          <div className="pension-label">Projected pot at age 67</div>
          <div className="pension-val">{fmtGbpInt(data?.projectedPot ?? null)}</div>
          <div className="pension-sub">
            {data ? `${STATUS_COPY[data.autoEnrolmentStatus] ?? data.autoEnrolmentStatus} · ${data.detail.yearsToRetirement} yrs to age 67` : '—'}
          </div>
        </div>
        <div className="section-title" style={{ padding: '0 0 10px', fontSize: 13 }}>
          Current monthly contribution
        </div>
        <div className="pension-pot">
          {data ? <PensionCurrent d={data} /> : <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Loading…</div>}
        </div>
        <div className="section-title" style={{ padding: '14px 0 10px', fontSize: 13 }}>
          If you increased your contribution
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {data?.increaseScenarios?.map((s, i) => (
            <Scenario key={i} s={s} baselinePot={data.projectedPot} />
          ))}
        </div>
        {data?.lostPensionNudge && (
          <div style={{ background: 'var(--teal-tint)', border: '1px solid var(--teal-border)', borderRadius: 'var(--r-md)', padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', color: 'var(--teal-text)', fontSize: 12, lineHeight: 1.5 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🔍</span>
            <div>
              <strong style={{ color: 'var(--text-1)' }}>Find lost pension pots</strong>
              <br />
              You've been employed long enough to likely have pension pots at previous employers. The government can help you track them down free.
              <br />
              <a href={data.governmentTracingUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal-text)', fontWeight: 700, textDecoration: 'underline' }}>
                Open the GOV.UK pension tracing service →
              </a>
            </div>
          </div>
        )}
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

function PensionCurrent({ d }: { d: PensionResponse }) {
  const emp = d.currentContributionPercent;
  const er = d.employerContributionPercent;
  const enrolled = d.autoEnrolmentStatus === 'enrolled';
  return (
    <>
      <div className="pension-pot-header">
        <div>
          <div className="pension-pot-name">{enrolled ? 'You + Crown Pub Group' : 'Not yet contributing'}</div>
          <div className="pension-pot-provider">Reference gross £{d.detail.referenceGrossPay.toFixed(2)}/period</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="pension-pot-val">{fmtGbpInt(d.totalMonthlyContribution)}</div>
          <div className="pension-pot-growth">per month</div>
        </div>
      </div>
      <div className="loan-row">
        <span className="loan-label">You contribute</span>
        <span className="loan-val">{emp}% · {fmtGbpInt(d.detail.referenceGrossPay * (emp / 100))}/mo</span>
      </div>
      <div className="loan-row" style={{ border: 'none' }}>
        <span className="loan-label">Employer contributes</span>
        <span className="loan-val">
          {er}% · {enrolled ? fmtGbpInt(d.detail.referenceGrossPay * (er / 100)) + '/mo' : 'starts when you enrol'}
        </span>
      </div>
    </>
  );
}

function Scenario({ s, baselinePot }: { s: PensionScenario; baselinePot: number }) {
  const headline = baselinePot > 0 ? `+ ${fmtGbpInt(s.potUplift)} more at retirement` : `${fmtGbpInt(s.projectedPot)} projected pot`;
  return (
    <div className="pension-pot" style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Contribute {s.newEmployeePercent}%</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)' }}>+ {fmtGbpInt(s.extraMonthlyCost)}/mo</div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--teal-text)' }}>{headline}</div>
    </div>
  );
}
