import { usePersona } from '../../hooks/usePersona';
import type { PersonaKey } from '../../types/api';

const ORDER: PersonaKey[] = ['jordan', 'marcus'];

export function PersonaSwitcher() {
  const { key, switchPersona } = usePersona();
  return (
    <div className="persona-switcher">
      <div className="persona-switcher-label">Demo persona</div>
      <div className="persona-pills">
        {ORDER.map((k) => (
          <div
            key={k}
            className={'persona-pill' + (k === key ? ' active' : '')}
            onClick={() => switchPersona(k)}
          >
            <span className="persona-pill-avatar">{k === 'jordan' ? 'JH' : 'MT'}</span>
            <span>{k === 'jordan' ? 'Jordan' : 'Marcus'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
