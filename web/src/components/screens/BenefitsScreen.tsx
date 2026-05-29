import { useApi } from '../../hooks/useApi';
import type { BenefitsResponse } from '../../types/api';
import { BackHeader } from '../shared/BackHeader';

const META: Record<keyof BenefitsResponse, { icon: string; label: string }> = {
  holiday:            { icon: '🌴', label: 'Holiday entitlement' },
  sickPay:            { icon: '🤒', label: 'Statutory sick pay' },
  pension:            { icon: '🏦', label: 'Pension auto-enrolment' },
  nmwCompliance:      { icon: '💷', label: 'National Minimum Wage' },
  maternityPaternity: { icon: '👶', label: 'Maternity / paternity' },
};

const ORDER: (keyof BenefitsResponse)[] = ['holiday', 'sickPay', 'pension', 'nmwCompliance', 'maternityPaternity'];

function statusFor(key: keyof BenefitsResponse, b: BenefitsResponse[keyof BenefitsResponse]) {
  if (key === 'holiday') {
    const h = b as BenefitsResponse['holiday'];
    return { text: `${h.accruedDays}/${h.annualDays} days`, color: 'var(--teal-text)' };
  }
  if (key === 'sickPay') {
    const s = b as BenefitsResponse['sickPay'];
    return { text: s.eligible ? 'Eligible' : 'Not eligible', color: s.eligible ? 'var(--teal-text)' : 'var(--orange-text)' };
  }
  if (key === 'pension') {
    const p = b as BenefitsResponse['pension'];
    return { text: p.autoEnrolEligible ? 'Eligible' : 'Below threshold', color: p.autoEnrolEligible ? 'var(--teal-text)' : 'var(--orange-text)' };
  }
  if (key === 'nmwCompliance') {
    const n = b as BenefitsResponse['nmwCompliance'];
    return { text: n.compliant ? `£${n.yourRate}/hr ✓` : `£${n.yourRate}/hr below`, color: n.compliant ? 'var(--teal-text)' : '#A23B36' };
  }
  if (key === 'maternityPaternity') {
    const m = b as BenefitsResponse['maternityPaternity'];
    return { text: m.eligible ? 'Eligible' : 'Not yet eligible', color: m.eligible ? 'var(--teal-text)' : 'var(--orange-text)' };
  }
  return { text: '', color: 'var(--text-3)' };
}

export function BenefitsScreen() {
  const { data } = useApi<BenefitsResponse>('/api/v1/benefits');

  let eligibleCount = 0;
  if (data) {
    eligibleCount =
      (data.sickPay.eligible ? 1 : 0) +
      (data.pension.autoEnrolEligible ? 1 : 0) +
      (data.nmwCompliance.compliant ? 1 : 0) +
      (data.maternityPaternity.eligible ? 1 : 0) +
      ((data.holiday as { eligible?: boolean }).eligible ?? true ? 1 : 0);
  }

  return (
    <div className="screen active">
      <BackHeader title="Benefits checker" />
      <div className="benefits-body">
        <div className="benefits-banner">
          <div className="benefits-banner-label">Your statutory employment benefits</div>
          <div className="benefits-banner-val">{data ? `${eligibleCount} of 5 entitlements active` : '—'}</div>
          <div className="benefits-banner-sub">Calculated from your live HR + payroll data</div>
        </div>
        <div className="section-title" style={{ padding: '0 0 10px', fontSize: 13 }}>
          What you're entitled to
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data ? (
            ORDER.map((k) => {
              const b = data[k];
              const m = META[k];
              const s = statusFor(k, b);
              return (
                <div key={k} className="benefit-item">
                  <div className="benefit-icon" style={{ background: 'var(--teal-tint)' }}>{m.icon}</div>
                  <div>
                    <div className="benefit-name">{m.label}</div>
                    <div className="benefit-desc">{b.detail}</div>
                  </div>
                  <div className="benefit-right">
                    <div className="benefit-status" style={{ color: s.color, fontWeight: 700 }}>
                      {s.text}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Loading…</div>
          )}
        </div>
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
