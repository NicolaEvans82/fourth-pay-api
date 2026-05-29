import { useMemo, useState } from 'react';
import { useApi, useApiClient } from '../../hooks/useApi';
import { useScreenNav } from '../../hooks/useNavigate';
import {
  GIFT_CARD_PARTNERS,
  type BalanceResponse,
  type GiftCardPartner,
  type TransferResult,
  type TransferSpeed,
} from '../../types/api';
import { Icon } from '../shared/Icon';
import { useTransferResult } from '../../contexts/TransferResultContext';

type Speed = TransferSpeed;

export function GetPaidScreen() {
  const { go } = useScreenNav();
  const { data: balance } = useApi<BalanceResponse>('/api/v1/ewa/balance');
  const apiClient = useApiClient();
  const { setResult } = useTransferResult();

  const available = balance?.availableAmount ?? 312.5;
  const monthlyLimit = balance?.monthlyLimitAmount ?? 200;
  const accessedThisMonth = balance?.accessedAmount ?? 0;
  const remaining = Math.max(0, monthlyLimit - accessedThisMonth);
  const maxAccessible = Math.min(available, remaining);

  const [amount, setAmount] = useState<number>(Math.max(10, Math.floor(maxAccessible)));
  const [speed, setSpeed] = useState<Speed>('instant');
  const [employerSubsidy, setEmployerSubsidy] = useState(true);
  const [giftCardPartner, setGiftCardPartner] = useState<GiftCardPartner>('tesco');
  const [submitting, setSubmitting] = useState(false);

  const isGiftCard = speed === 'gift_card';
  const feeSubsidised = employerSubsidy && speed === 'instant';
  const fee = speed === 'instant' && amount > 0 ? 1.95 : 0;
  const actualFee = isGiftCard ? 0 : feeSubsidised ? 0 : fee;
  const willReceive = Math.max(0, amount - actualFee);

  const feeLabel = useMemo(() => {
    if (isGiftCard) return 'Free (gift card)';
    if (actualFee === 0) return feeSubsidised ? 'Free (employer pays)' : 'Free';
    return '£' + actualFee.toFixed(2);
  }, [actualFee, feeSubsidised, isGiftCard]);

  const submit = async () => {
    if (amount < 10) {
      // eslint-disable-next-line no-alert
      alert('Enter an amount of at least £10.');
      return;
    }
    setSubmitting(true);
    const body: Record<string, unknown> = {
      amount,
      transferSpeed: speed,
      fcaDisclosureAcknowledged: true,
    };
    if (isGiftCard) body.giftCardPartner = giftCardPartner;
    const res = await apiClient<TransferResult>('POST', '/api/v1/ewa/transfer', body);
    setSubmitting(false);
    if (!res.ok || !res.data) {
      // eslint-disable-next-line no-alert
      alert(res.error || 'Transfer failed.');
      return;
    }
    setResult(res.data, amount);
    go('confirm');
  };

  return (
    <div className="screen active">
      <div className="dark-header">
        <div className="screen-title-row">
          <button className="back-btn" onClick={() => go('home')}>
            <Icon name="back" />
          </button>
          <div className="screen-title">Get paid now</div>
        </div>
      </div>
      <div className="stream-body">
        <div className="avail-banner" style={{ marginBottom: 'var(--s3)' }}>
          <div className="avail-label">Available to access</div>
          <div className="avail-amt">£{available.toFixed(2)}</div>
        </div>
        <div className="limit-warn" style={{ marginBottom: 'var(--s3)' }}>
          <Icon name="warning" size={16} color="var(--orange-text)" />
          <span>
            Monthly limit £{monthlyLimit.toFixed(0)}. Used £{accessedThisMonth.toFixed(0)} so far — £{remaining.toFixed(0)} remaining.
          </span>
        </div>
        <div className="amount-card">
          <label>How much do you need?</label>
          <div className="amount-row">
            <div className="amt-prefix">£</div>
            <input
              className="amt-input"
              type="number"
              min={10}
              max={Math.max(10, Math.floor(maxAccessible))}
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            />
          </div>
          <input
            type="range"
            min={10}
            max={Math.max(10, Math.floor(maxAccessible))}
            step={5}
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
            <span>£10</span>
            <span>£{Math.floor(maxAccessible)} remaining</span>
          </div>
        </div>
        <div className="presets">
          {[20, 30, 50, 70].map((v) => (
            <div
              key={v}
              className={'preset' + (amount === v ? ' sel' : '')}
              onClick={() => setAmount(v)}
            >
              £{v}
            </div>
          ))}
        </div>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
            Transfer speed
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <SpeedOption active={speed === 'instant'} onClick={() => setSpeed('instant')} title="⚡ Instant" sub="Within minutes" right={feeSubsidised ? 'Free (employer)' : '£1.95'} />
            <SpeedOption active={speed === 'standard'} onClick={() => setSpeed('standard')} title="🕐 Standard" sub="1–3 days" right="Free" />
            <SpeedOption active={speed === 'gift_card'} onClick={() => setSpeed('gift_card')} title="🎁 Gift card" sub="Instant" right="Free" />
          </div>
          {isGiftCard && (
            <GiftCardSelector partner={giftCardPartner} onChange={setGiftCardPartner} />
          )}
        </div>
        {!isGiftCard && (
          <div style={{ background: 'var(--teal-tint)', border: '1px solid rgba(0,182,159,0.25)', borderRadius: 'var(--r-sm)', padding: '11px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="building" size={18} color="var(--teal-text)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal-text)' }}>Your employer covers the fee</div>
              <div style={{ fontSize: 11, color: 'var(--teal-text)', opacity: 0.8 }}>
                The Crown Pub Group pays the £1.95 instant fee for you
              </div>
            </div>
            <div
              className={'toggle ' + (employerSubsidy ? 'on' : 'off')}
              onClick={() => setEmployerSubsidy((s) => !s)}
              style={{ flexShrink: 0 }}
            >
              <div className="toggle-thumb" />
            </div>
          </div>
        )}
        <div className="info-row">
          <span className="info-label">Transaction fee</span>
          <span className="info-val" style={{ color: actualFee === 0 ? 'var(--teal)' : 'var(--text-1)' }}>
            {feeLabel}
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Monthly limit remaining after</span>
          <span className="info-val orange">£{Math.max(0, remaining - amount).toFixed(2)}</span>
        </div>
        {!isGiftCard && (
          <div className="bank-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="bank-logo">M</div>
              <div>
                <div className="bank-name">Monzo</div>
                <div className="bank-num">•••• 4891</div>
              </div>
            </div>
            <Icon name="chevronR" color="var(--text-3)" />
          </div>
        )}
        <div className="receive-row">
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal-text)' }}>You'll receive</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>£{willReceive.toFixed(2)}</span>
        </div>
        <button className="btn btn-teal" disabled={submitting} onClick={submit}>
          {speed === 'instant' && (
            <>
              <Icon name="bolt" /> {submitting ? 'Processing…' : 'Access pay instantly'}
            </>
          )}
          {speed === 'standard' && (
            <>
              <Icon name="info" /> {submitting ? 'Processing…' : 'Request standard transfer'}
            </>
          )}
          {speed === 'gift_card' && (
            <>🎁 {submitting ? 'Processing…' : `Withdraw as ${partnerName(giftCardPartner)} gift card`}</>
          )}
        </button>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>
          FCA regulated ·{' '}
          {speed === 'instant'
            ? 'Arrives within minutes'
            : speed === 'standard'
              ? 'Arrives in 1–3 working days'
              : 'Gift card withdrawals are instant and free. The gift card value equals your requested amount.'}{' '}
          ·{' '}
          <span style={{ color: 'var(--teal)', fontWeight: 700, cursor: 'pointer' }} onClick={() => go('controls')}>
            Manage limits →
          </span>
        </p>
      </div>
    </div>
  );
}

function partnerName(slug: GiftCardPartner): string {
  return GIFT_CARD_PARTNERS.find((p) => p.slug === slug)?.name ?? slug;
}

interface GiftCardSelectorProps {
  partner: GiftCardPartner;
  onChange: (p: GiftCardPartner) => void;
}
function GiftCardSelector({ partner, onChange }: GiftCardSelectorProps) {
  return (
    <>
      <div
        style={{
          marginTop: 12,
          padding: '10px 12px',
          background: 'var(--teal-tint)',
          borderRadius: 8,
          fontSize: 11,
          color: 'var(--teal-text)',
          lineHeight: 1.5,
        }}
      >
        Withdraw as a gift card from our partners — no transfer fee.
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)',
          gap: 8,
          marginTop: 10,
        }}
      >
        {GIFT_CARD_PARTNERS.map((p) => {
          const active = partner === p.slug;
          return (
            <button
              key={p.slug}
              onClick={() => onChange(p.slug)}
              style={{
                padding: '12px 6px',
                background: active ? p.bg : 'white',
                color: active ? p.fg : 'var(--text-1)',
                border: active ? `2px solid ${p.bg}` : '1px solid var(--border)',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 800,
                fontFamily: 'var(--font)',
                letterSpacing: '-0.2px',
                transition: 'all 0.15s',
              }}
            >
              {p.name}
            </button>
          );
        })}
      </div>
    </>
  );
}

interface SpeedProps {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  right: string;
}
function SpeedOption({ active, onClick, title, sub, right }: SpeedProps) {
  return (
    <div
      onClick={onClick}
      style={{
        border: active ? '2px solid var(--teal)' : '1px solid var(--border)',
        borderRadius: 8,
        padding: 10,
        cursor: 'pointer',
        background: active ? 'var(--teal-tint)' : 'white',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--teal)', marginTop: 4 }}>{right}</div>
    </div>
  );
}
