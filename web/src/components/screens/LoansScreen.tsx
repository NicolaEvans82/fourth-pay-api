import { BackHeader } from '../shared/BackHeader';
import { Icon } from '../shared/Icon';

export function LoansScreen() {
  return (
    <div className="screen active">
      <BackHeader title="Workplace loans" />
      <div className="loans-body">
        <div className="loan-card">
          <div className="loan-card-header">
            <div className="loan-type">Active loan</div>
            <div className="loan-amount">£500.00</div>
          </div>
          <div className="loan-details">
            <div className="loan-row"><span className="loan-label">Interest rate</span><span className="loan-val" style={{ color: 'var(--teal)' }}>9.9% APR</span></div>
            <div className="loan-row"><span className="loan-label">Monthly repayment</span><span className="loan-val">£43.75</span></div>
            <div className="loan-row"><span className="loan-label">Repaid from</span><span className="loan-val">Salary (auto)</span></div>
            <div className="loan-row"><span className="loan-label">Remaining</span><span className="loan-val">£325.00</span></div>
            <div className="loan-row"><span className="loan-label">Final payment</span><span className="loan-val">Nov 2026</span></div>
          </div>
          <div className="repay-progress">
            <div className="repay-label"><span>Repayment progress</span><span style={{ color: 'var(--teal)' }}>35% paid</span></div>
            <div className="prog-track"><div className="prog-fill" style={{ width: '35%' }} /></div>
          </div>
        </div>

        <div className="section-title" style={{ padding: '0 0 12px', fontSize: 13 }}>
          Apply for a new loan
        </div>

        <div className="loan-option">
          <div className="loan-opt-header">
            <div>
              <div className="loan-opt-name">Emergency loan</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Up to £500 · Fast approval</div>
            </div>
            <div className="loan-opt-rate">9.9%<span> APR</span></div>
          </div>
          <div className="eligibility-tag">
            <Icon name="check" size={12} />
            You're eligible
          </div>
          <div className="loan-opt-body">
            For unexpected costs. Repaid from salary over 3–12 months. No credit check. Decision in minutes.
          </div>
          <button className="btn btn-teal btn-sm">Apply now</button>
        </div>

        <div className="loan-option">
          <div className="loan-opt-header">
            <div>
              <div className="loan-opt-name">Debt consolidation</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Up to £2,000 · Lower your payments</div>
            </div>
            <div className="loan-opt-rate">12.9%<span> APR</span></div>
          </div>
          <div className="eligibility-tag" style={{ background: 'rgba(0,39,71,0.06)', color: 'var(--navy)' }}>
            <Icon name="info" size={12} />
            3 months tenure needed
          </div>
          <div className="loan-opt-body">
            Consolidate existing debt at a lower rate. Repaid from salary. Salary-linked repayment keeps it affordable.
          </div>
          <button className="btn btn-ghost btn-sm">Learn more</button>
        </div>
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
