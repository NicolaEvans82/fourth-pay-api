import { useState } from 'react';
import { useScreenNav } from '../../hooks/useNavigate';
import { BackHeader } from '../shared/BackHeader';
import { Icon } from '../shared/Icon';

export function SavingsScreen() {
  const { go } = useScreenNav();
  const [roundupOn, setRoundupOn] = useState(false);
  const [activePot, setActivePot] = useState<'emergency' | 'holiday'>('emergency');

  return (
    <div className="screen active">
      <BackHeader title="Save & budget" />
      <div className="save-body">
        <div className="save-hero">
          <div className="save-hero-label">Total savings</div>
          <div className="save-hero-amount">£247.50</div>
          <div className="save-hero-rate">4.5% AER · FSCS protected up to £85,000</div>
        </div>
        <div className="section-title" style={{ padding: '0 0 10px', fontSize: 13 }}>
          Your pots
        </div>
        <PotRow
          icon="🆘"
          iconBg="var(--teal-tint)"
          title="Emergency fund"
          balanceLabel="£147.50"
          goalLabel="No limit"
          progressPct={100}
          interestLabel="£6.64 interest this year"
          badge={<span className="badge badge-teal">Active</span>}
        />
        <PotRow
          icon="✈️"
          iconBg="var(--orange-tint)"
          title="Holiday fund"
          balanceLabel="£100.00"
          goalLabel="Goal £500"
          progressPct={20}
          interestLabel="£4.50 interest this year"
          badge={<span className="badge badge-orange">20%</span>}
        />
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic', margin: '4px 2px 12px' }}>
          Interest paid when connected to banking infrastructure.
        </div>
        <div style={{ marginBottom: 16 }}>
          <button className="btn btn-orange" style={{ marginBottom: 8 }}>
            <Icon name="plus" /> Create new pot
          </button>
        </div>
        <div className="section-title" style={{ padding: '0 0 10px', fontSize: 13 }}>
          Saving rules
        </div>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Round-up saving</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                Round each shift's pay down to the nearest £1 and save the difference automatically
              </div>
            </div>
            <div
              className={'toggle ' + (roundupOn ? 'on' : 'off')}
              onClick={() => setRoundupOn((v) => !v)}
              style={{ marginLeft: 12, flexShrink: 0 }}
            >
              <div className="toggle-thumb" />
            </div>
          </div>
          {roundupOn && (
            <div style={{ background: 'var(--teal-tint)', borderRadius: 8, padding: '10px 12px', marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal-text)' }}>Save to which pot?</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
                <PotChoice label="🆘 Emergency fund" active={activePot === 'emergency'} onClick={() => setActivePot('emergency')} />
                <PotChoice label="✈️ Holiday fund" active={activePot === 'holiday'} onClick={() => setActivePot('holiday')} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--teal-text)', marginTop: 8 }}>
                Est. saving: ~£4–12 per pay period based on your shifts
              </div>
            </div>
          )}
        </div>
        <div className="section-title" style={{ padding: '0 0 10px', fontSize: 13 }}>
          Money tools
        </div>
        <div className="list-item" onClick={() => go('benefits')}>
          <div className="list-item-left">
            <div className="list-icon" style={{ background: 'rgba(0,39,71,0.08)' }}>📋</div>
            <div>
              <div className="list-title">Benefits checker</div>
              <div className="list-sub">Find unclaimed government support</div>
            </div>
          </div>
          <Icon name="chevronR" color="var(--text-3)" />
        </div>
        <div className="list-item" onClick={() => go('coach')}>
          <div className="list-item-left">
            <div className="list-icon" style={{ background: 'rgba(250,165,26,0.15)' }}>🤖</div>
            <div>
              <div className="list-title">Financial coaching</div>
              <div className="list-sub">Free AI money coach</div>
            </div>
          </div>
          <Icon name="chevronR" color="var(--text-3)" />
        </div>
      </div>
    </div>
  );
}

interface PotRowProps {
  icon: string;
  iconBg: string;
  title: string;
  balanceLabel: string;
  goalLabel: string;
  progressPct: number;
  interestLabel: string;
  badge: React.ReactNode;
}
function PotRow({ icon, iconBg, title, balanceLabel, goalLabel, progressPct, interestLabel, badge }: PotRowProps) {
  return (
    <div className="list-item">
      <div className="list-item-left">
        <div className="list-icon" style={{ background: iconBg }}>{icon}</div>
        <div>
          <div className="list-title">{title}</div>
          <div className="pot-bar-wrap">
            <div className="pot-prog">
              <div className="pot-prog-fill" style={{ width: progressPct + '%' }} />
            </div>
            <div className="pot-prog-label">
              <span>{balanceLabel}</span>
              <span>{goalLabel}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
            <span className="badge badge-teal" style={{ fontSize: 10 }}>Earning 4.5% AER</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{interestLabel}</span>
          </div>
        </div>
      </div>
      {badge}
    </div>
  );
}
function PotChoice({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'white',
        border: active ? '2px solid var(--teal)' : '1px solid var(--border)',
        borderRadius: 8,
        padding: 8,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 700,
        color: active ? 'var(--text-1)' : 'var(--text-3)',
      }}
    >
      {label}
    </div>
  );
}
