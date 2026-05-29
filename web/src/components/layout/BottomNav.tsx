import { useScreenNav, NAV_MAP, NO_NAV } from '../../hooks/useNavigate';
import { Icon } from '../shared/Icon';

const TABS = [
  { key: 'home', label: 'Home', icon: 'home' as const, target: 'home' as const },
  { key: 'shifts', label: 'Shifts', icon: 'cal' as const, target: 'shifts' as const },
  { key: 'stream', label: 'Pay', icon: 'bolt' as const, target: 'stream' as const },
  { key: 'save', label: 'Money', icon: 'coin' as const, target: 'save' as const },
  { key: 'wellbeing', label: 'More', icon: 'grid' as const, target: 'wellbeing' as const },
] as const;

export function BottomNav() {
  const { current, go } = useScreenNav();
  if (NO_NAV.has(current)) return null;
  const activeTab = NAV_MAP[current];
  return (
    <div className="bottom-nav">
      {TABS.map((t) => (
        <div
          key={t.key}
          className={'nav-item' + (activeTab === t.key ? ' active' : '')}
          onClick={() => go(t.target)}
        >
          <Icon name={t.icon} />
          <span>{t.label}</span>
        </div>
      ))}
    </div>
  );
}
