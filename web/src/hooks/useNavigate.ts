import { createContext, useContext } from 'react';

// Names of every in-app screen the phone can show. Routes (URL paths)
// are kept minimal — / and /employer — and within / the user navigates
// between these states. Matches the screen-name strings the original
// HTML used in `go(name)`.
export type ScreenName =
  | 'home'
  | 'stream'      // Get paid now
  | 'confirm'     // Post-transfer confirmation
  | 'track'       // Earnings tracker
  | 'shifts'
  | 'spend'       // Spending tracker
  | 'save'        // Savings + budget hub
  | 'budget'
  | 'loans'
  | 'benefits'
  | 'pension'
  | 'coach'
  | 'wellbeing'
  | 'discounts'
  | 'payslip'
  | 'controls'
  | 'notifications'
  | 'profile'
  | 'learn';

interface NavContextValue {
  current: ScreenName;
  go: (name: ScreenName) => void;
}

export const NavContext = createContext<NavContextValue | null>(null);

export function useScreenNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useScreenNav must be inside <NavContext.Provider>');
  return ctx;
}

// Screens that hide the bottom nav (modal/secondary surfaces).
export const NO_NAV: ReadonlySet<ScreenName> = new Set<ScreenName>([
  'confirm',
  'payslip',
  'controls',
  'notifications',
  'profile',
  'coach',
  'pension',
  'benefits',
  'loans',
  'discounts',
  'spend',
  'budget',
  'learn',
]);

// Map every screen back to one of the 5 bottom-nav tabs so the
// correct icon highlights when the user lands on a deeper surface.
type NavTab = 'home' | 'shifts' | 'stream' | 'save' | 'wellbeing';

export const NAV_MAP: Record<ScreenName, NavTab> = {
  home: 'home',
  shifts: 'shifts',
  track: 'shifts',
  stream: 'stream',
  confirm: 'stream',
  save: 'save',
  wellbeing: 'wellbeing',
  spend: 'home',
  discounts: 'save',
  payslip: 'home',
  controls: 'home',
  notifications: 'home',
  profile: 'home',
  coach: 'wellbeing',
  pension: 'wellbeing',
  benefits: 'wellbeing',
  loans: 'save',
  budget: 'home',
  learn: 'wellbeing',
};
