import { useEffect, useState } from 'react';
import { Icon } from '../shared/Icon';

function formatNow() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
}

export function StatusBar() {
  const [clock, setClock] = useState(formatNow());
  useEffect(() => {
    const t = window.setInterval(() => setClock(formatNow()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="status-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 5,
            background: 'var(--teal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: 'white',
          }}
        >
          F
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'white', letterSpacing: '-0.2px' }}>Fourth</span>
      </div>
      <div className="status-icons">
        <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>{clock}</span>
        <Icon name="wifi" />
        <Icon name="battery" />
      </div>
    </div>
  );
}
