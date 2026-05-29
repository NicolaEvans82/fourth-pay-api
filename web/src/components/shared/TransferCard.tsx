import { fmtGbp, fmtDay } from '../../format';
import type { Transfer } from '../../types/api';
import { Icon } from './Icon';

export function TransferCard({ t }: { t: Transfer }) {
  const speed = t.transferSpeed === 'instant' ? 'Instant' : 'Standard';
  return (
    <div className="activity-item">
      <div className="a-icon" style={{ background: 'var(--teal-tint)', color: 'var(--teal)' }}>
        <Icon name="bolt" />
      </div>
      <div className="a-body">
        <div className="a-title">Pay access</div>
        <div className="a-date">
          {fmtDay(t.initiatedAt)} · {speed} · {t.status}
        </div>
      </div>
      <div className="a-amount out">+{fmtGbp(t.amount)}</div>
    </div>
  );
}
