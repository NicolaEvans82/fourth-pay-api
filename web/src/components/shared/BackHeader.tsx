import { useScreenNav, type ScreenName } from '../../hooks/useNavigate';
import { Icon } from './Icon';

interface Props {
  title: string;
  back?: ScreenName;
  right?: React.ReactNode;
}

export function BackHeader({ title, back = 'home', right }: Props) {
  const { go } = useScreenNav();
  return (
    <div className="dark-header-sm">
      <div
        className="screen-title-row"
        style={right ? { justifyContent: 'space-between' } : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={() => go(back)}>
            <Icon name="back" size={20} />
          </button>
          <div className="screen-title">{title}</div>
        </div>
        {right}
      </div>
    </div>
  );
}
