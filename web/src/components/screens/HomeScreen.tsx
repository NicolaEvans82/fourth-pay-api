import { useApi } from '../../hooks/useApi';
import { useScreenNav, type ScreenName } from '../../hooks/useNavigate';
import { usePersona } from '../../hooks/usePersona';
import type { BalanceResponse, NotificationsResponse, TransfersResponse } from '../../types/api';
import { PersonaSwitcher } from '../layout/PersonaSwitcher';
import { BalanceCard } from '../shared/BalanceCard';
import { Icon } from '../shared/Icon';
import { TransferCard } from '../shared/TransferCard';

interface QuickAction {
  target: ScreenName;
  icon: Parameters<typeof Icon>[0]['name'];
  iconBg: string;
  iconColor: string;
  label: string;
  sub: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { target: 'stream',    icon: 'bolt',   iconBg: 'var(--teal-tint)',          iconColor: 'var(--teal)',   label: 'Get paid now',  sub: 'Instant transfer' },
  { target: 'track',     icon: 'trend',  iconBg: 'rgba(0,39,71,0.08)',        iconColor: 'var(--navy)',   label: 'Track earnings', sub: 'Shifts & pay' },
  { target: 'spend',     icon: 'card',   iconBg: '#e8f4fd',                   iconColor: '#1a7abf',       label: 'Spending',       sub: 'All accounts' },
  { target: 'save',      icon: 'piggy',  iconBg: 'var(--orange-tint)',        iconColor: 'var(--orange)', label: 'Save',           sub: 'Build your pot' },
  { target: 'loans',     icon: 'coin',   iconBg: '#e8f8f4',                   iconColor: '#00937f',       label: 'Borrow',         sub: 'Workplace loans' },
  { target: 'benefits',  icon: 'shield', iconBg: 'var(--red-tint)',           iconColor: 'var(--red-text)', label: 'Benefits',     sub: "What you're owed" },
  { target: 'pension',   icon: 'pension',iconBg: '#f3e8ff',                   iconColor: '#8b5cf6',       label: 'Pension',        sub: 'Find & combine' },
  { target: 'coach',     icon: 'robot',  iconBg: 'rgba(250,165,26,0.15)',     iconColor: 'var(--orange)', label: 'Money coach',    sub: 'AI-powered help' },
  { target: 'budget',    icon: 'doc',    iconBg: '#e8f4fd',                   iconColor: '#1a7abf',       label: 'Budget',         sub: 'Set a plan' },
  { target: 'learn',     icon: 'book',   iconBg: '#f3e8ff',                   iconColor: '#8b5cf6',       label: 'Learn',          sub: 'Financial guides' },
];

export function HomeScreen() {
  const { go } = useScreenNav();
  const { persona } = usePersona();
  const balance = useApi<BalanceResponse>('/api/v1/ewa/balance');
  const transfers = useApi<TransfersResponse>('/api/v1/ewa/transfers');
  const notifs = useApi<NotificationsResponse>('/api/v1/notifications');
  const hasUnread = (notifs.data?.unreadCount ?? 0) > 0;

  return (
    <div className="screen active">
      <PersonaSwitcher />

      <div style={{ padding: 'var(--s4) var(--s4) var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'var(--teal)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
              color: 'white',
              flexShrink: 0,
            }}
            onClick={() => go('profile')}
          >
            {persona.initials}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.3px' }}>
              Good morning, {persona.firstName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
              Pay day in 10 days · Everything's on track
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
          <button className="icon-btn" onClick={() => go('notifications')}>
            <Icon name="bell" size={20} />
            {hasUnread && <div className="notif-badge" />}
          </button>
        </div>
      </div>

      <div style={{ padding: '0 var(--s4) var(--s3)' }}>
        <BalanceCard data={balance.data} />

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            padding: 'var(--s4)',
            marginTop: 'var(--s3)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s2)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>✦ iQ Insight</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal-text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              94% confidence
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 'var(--s3)' }}>
            You've accessed pay 3 times this period — consider a savings rule to build a buffer before your next payday.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s2)' }}>
            <button
              onClick={() => go('save')}
              style={insightBtnStyle}
            >
              Set up saving
            </button>
            <button onClick={() => go('payslip')} style={insightBtnStyle}>
              View payslip
            </button>
          </div>
        </div>
      </div>

      <div className="section-header">
        <div className="section-title">Quick actions</div>
      </div>
      <div className="quick-actions">
        {QUICK_ACTIONS.map((qa) => (
          <div key={qa.target} className="qa-btn" onClick={() => go(qa.target)}>
            <div className="qa-icon" style={{ background: qa.iconBg, color: qa.iconColor }}>
              <Icon name={qa.icon} />
            </div>
            <span className="qa-label">{qa.label}</span>
            <span className="qa-sub">{qa.sub}</span>
          </div>
        ))}
      </div>

      <div className="section-header">
        <div className="section-title">Recent activity</div>
        <div className="section-link" onClick={() => go('track')}>
          See all
        </div>
      </div>
      <div className="activity-list">
        {transfers.data?.transfers && transfers.data.transfers.length > 0 ? (
          transfers.data.transfers.map((t) => <TransferCard key={t.id} t={t} />)
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No transfers yet — tap <strong>Get paid now</strong> to access your earned pay
          </div>
        )}
      </div>
      <div style={{ height: 16 }} />
    </div>
  );
}

const insightBtnStyle: React.CSSProperties = {
  background: 'var(--bg-page)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)',
  padding: 'var(--s2) var(--s3)',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-1)',
  cursor: 'pointer',
  fontFamily: 'var(--font)',
};
