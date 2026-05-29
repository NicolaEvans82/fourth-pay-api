import { useScreenNav } from '../../hooks/useNavigate';
import { useTransferResult } from '../../contexts/TransferResultContext';
import { fmtGbp } from '../../format';
import { Icon } from '../shared/Icon';

export function ConfirmScreen() {
  const { go } = useScreenNav();
  const { lastResult, requestedAmount } = useTransferResult();
  return (
    <div className="screen active">
      <div className="confirm-body">
        <div className="confirm-icon">
          <Icon name="check" />
        </div>
        <div className="confirm-title">Transfer confirmed!</div>
        <div className="confirm-sub">On its way to your Monzo account</div>
        <div className="confirm-big">{fmtGbp(lastResult?.netAmount ?? null)}</div>
        <div className="confirm-detail">
          <div className="c-row">
            <span className="c-label">Requested</span>
            <span className="c-val">{fmtGbp(requestedAmount)}</span>
          </div>
          <div className="c-row">
            <span className="c-label">Fee</span>
            <span className="c-val">
              {lastResult?.feeAmount === 0 ? 'Free (employer pays)' : fmtGbp(lastResult?.feeAmount ?? null)}
            </span>
          </div>
          <div className="c-row">
            <span className="c-label">Account</span>
            <span className="c-val">Monzo •••• 4891</span>
          </div>
          <div className="c-row">
            <span className="c-label">Arrives</span>
            <span className="c-val" style={{ color: 'var(--teal)' }}>
              {lastResult?.estimatedArrival === 'immediate' ? 'Within minutes' : lastResult?.estimatedArrival ?? '—'}
            </span>
          </div>
          <div className="c-row">
            <span className="c-label">FCA reference</span>
            <span className="c-val" style={{ fontFamily: 'monospace', fontSize: 11 }}>
              {lastResult?.fcaReference ?? '—'}
            </span>
          </div>
        </div>
        <button className="btn btn-navy" onClick={() => go('home')} style={{ marginBottom: 10 }}>
          Back to home
        </button>
        <button className="btn btn-ghost" onClick={() => go('track')}>
          View history
        </button>
      </div>
    </div>
  );
}
