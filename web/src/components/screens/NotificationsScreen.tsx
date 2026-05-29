import { useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { fmtDay } from '../../format';
import type { NotifCategory, Notification, NotificationsResponse } from '../../types/api';
import { BackHeader } from '../shared/BackHeader';

type FilterKey = 'all' | 'pay' | 'savings' | 'payslip' | 'wellbeing' | 'pension';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pay', label: 'Pay & bills' },
  { key: 'savings', label: 'Savings' },
  { key: 'payslip', label: 'Payslips' },
  { key: 'wellbeing', label: 'Wellbeing' },
  { key: 'pension', label: 'Pension' },
];

const STYLE: Record<NotifCategory, { bg: string; color: string; icon: string }> = {
  pay:       { bg: 'var(--teal-tint)',  color: 'var(--teal)',     icon: '⚡' },
  savings:   { bg: 'var(--orange-tint)', color: 'var(--orange)',   icon: '💰' },
  payslip:   { bg: 'rgba(0,39,71,0.06)', color: 'var(--navy)',     icon: '📄' },
  wellbeing: { bg: '#e8f8f4',            color: '#00937f',         icon: '🫀' },
  pension:   { bg: '#f3e8ff',            color: '#8b5cf6',         icon: '🏦' },
  bills:     { bg: 'var(--red-tint)',    color: 'var(--red-text)', icon: '⚠️' },
  system:    { bg: 'rgba(0,39,71,0.06)', color: 'var(--navy)',     icon: 'ℹ️' },
};

export function NotificationsScreen() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [marked, setMarked] = useState(false);
  const { data } = useApi<NotificationsResponse>('/api/v1/notifications');

  const visible = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.notifications;
    return data.notifications.filter((n) => n.category === filter || (filter === 'pay' && n.category === 'bills'));
  }, [data, filter]);

  const totalCount = data?.notifications.length ?? 0;

  return (
    <div className="screen active">
      <BackHeader title="Notifications" />
      <div className="notif-body">
        <div className="notif-filter">
          {FILTERS.map((f) => (
            <div
              key={f.key}
              className={'chip' + (filter === f.key ? ' active' : '')}
              onClick={() => setFilter(f.key)}
            >
              {f.label}{f.key === 'all' ? ` (${totalCount})` : ''}
            </div>
          ))}
        </div>
        <span className="mark-all" onClick={() => setMarked(true)}>
          Mark all as read
        </span>
        <div>
          {visible.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              {data ? 'No notifications yet' : 'Loading…'}
            </div>
          ) : (
            visible.map((n) => <NotifItem key={n.id} n={n} silent={marked} />)
          )}
        </div>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

function NotifItem({ n, silent }: { n: Notification; silent: boolean }) {
  const style = STYLE[n.category] ?? STYLE.system;
  const isRead = silent || !!n.readAt;
  const cls = isRead ? '' : n.urgency === 'urgent' ? ' urgent' : ' unread';
  const dotColor = n.urgency === 'urgent' ? 'var(--red)' : n.urgency === 'warning' ? 'var(--orange)' : 'var(--teal)';
  const when = new Date(n.createdAt);
  const timeStr = `${fmtDay(n.createdAt)} · ${String(when.getUTCHours()).padStart(2, '0')}:${String(when.getUTCMinutes()).padStart(2, '0')}`;
  return (
    <div className={'notif-item' + cls}>
      <div className="notif-icon" style={{ background: style.bg, color: style.color }}>
        {style.icon}
      </div>
      <div className="notif-content">
        <div className="notif-title">{n.title}</div>
        <div className="notif-text">{n.body}</div>
        <div className="notif-time">{timeStr}</div>
      </div>
      {!isRead && <div className="unread-dot" style={{ background: dotColor }} />}
    </div>
  );
}
