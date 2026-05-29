import { usePersona } from '../../hooks/usePersona';
import { useScreenNav } from '../../hooks/useNavigate';
import { BackHeader } from '../shared/BackHeader';
import { Icon } from '../shared/Icon';

export function ProfileScreen() {
  const { persona } = usePersona();
  const { go } = useScreenNav();
  return (
    <div className="screen active">
      <BackHeader title="My profile" />
      <div className="profile-body">
        <div className="profile-hero">
          <div className="profile-avatar">{persona.initials}</div>
          <div className="profile-name">{persona.fullName}</div>
          <div className="profile-role">{persona.role}</div>
          <div className="profile-employer">The Crown Pub Group Ltd</div>
        </div>
        <div className="profile-section">
          <Row icon="bank" tint="var(--teal-tint)" color="var(--teal)" label="Bank account" val="Monzo •••• 4891" />
          <Row icon="sliders" tint="var(--red-tint)" color="var(--red-text)" label="Self-controls" val="Monthly limit: £200" onClick={() => go('controls')} />
          <Row icon="bell" tint="var(--orange-tint)" color="var(--orange)" label="Notifications" val="All enabled" onClick={() => go('notifications')} />
        </div>
        <div className="profile-section">
          <Row icon="flag" tint="rgba(0,39,71,0.08)" color="var(--navy)" label="Privacy & security" val="Face ID enabled" />
          <Row icon="fileText" tint="#e8f4fd" color="#1a7abf" label="FCA regulatory info" val="Authorised & regulated" />
          <Row icon="headset" tint="#f3e8ff" color="#8b5cf6" label="Help & support" val="Chat, email or call" />
          <Row icon="users" tint="#e8f8f4" color="#00937f" label="Refer a colleague" val="You'll both get £5" />
        </div>
        <button className="btn btn-ghost" style={{ color: 'var(--red-text)', borderColor: 'rgba(226,75,74,0.3)' }}>
          Sign out
        </button>
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

interface RowProps {
  icon: Parameters<typeof Icon>[0]['name'];
  tint: string;
  color: string;
  label: string;
  val: string;
  onClick?: () => void;
}
function Row({ icon, tint, color, label, val, onClick }: RowProps) {
  return (
    <div className="profile-row" onClick={onClick}>
      <div className="profile-row-left">
        <div className="pr-icon" style={{ background: tint }}>
          <Icon name={icon} size={15} color={color} />
        </div>
        <div>
          <div className="pr-label">{label}</div>
          <div className="pr-val">{val}</div>
        </div>
      </div>
      <Icon name="chevronR" size={20} color="var(--text-3)" />
    </div>
  );
}
