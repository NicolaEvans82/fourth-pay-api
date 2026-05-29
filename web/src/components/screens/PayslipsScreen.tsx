import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { fmtFullDate, fmtGbp, fmtMonthShort, fmtPeriodFull } from '../../format';
import type { Payslip, PayslipsResponse } from '../../types/api';
import { BackHeader } from '../shared/BackHeader';
import { Icon } from '../shared/Icon';

export function PayslipsScreen() {
  const { data } = useApi<PayslipsResponse>('/api/v1/payslips');
  const [activeIdx, setActiveIdx] = useState(0);
  const payslips = data?.payslips ?? [];
  const current = payslips[activeIdx];

  return (
    <div className="screen active">
      <BackHeader title="My payslips" />
      <div className="payslip-body">
        {payslips.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            {data ? 'No payslips yet' : 'Loading…'}
          </div>
        ) : (
          <>
            <div className="payslip-tabs">
              {payslips.map((p, i) => (
                <div
                  key={p.payPeriodStart}
                  className={'ptab' + (i === activeIdx ? ' active' : '')}
                  onClick={() => setActiveIdx(i)}
                >
                  {fmtMonthShort(p.payPeriodStart)}
                </div>
              ))}
            </div>
            {current && <PayslipCard p={current} />}
          </>
        )}
      </div>
    </div>
  );
}

function PayslipCard({ p }: { p: Payslip }) {
  return (
    <>
      <div className="payslip-card">
        <div className="ps-header">
          <div className="ps-employer">The Crown Pub Group Ltd</div>
          <div className="ps-period">{fmtPeriodFull(p.payPeriodStart)}</div>
          <div className="ps-ref">Paid {fmtFullDate(p.paymentDate)}</div>
        </div>
        <div className="ps-net">
          <div className="ps-net-label">Net pay</div>
          <div className="ps-net-amount">{fmtGbp(p.netPay)}</div>
          <div className="ps-net-sub">
            Gross {fmtGbp(p.grossPay)} · Monzo •••• 4891
          </div>
        </div>
      </div>
      <button className="btn btn-navy" style={{ marginTop: 12, marginBottom: 8 }}>
        <Icon name="download" /> Download PDF
      </button>
      <button className="btn btn-ghost">
        <Icon name="mail" /> Email to me
      </button>
      <div style={{ height: 16 }} />
    </>
  );
}
