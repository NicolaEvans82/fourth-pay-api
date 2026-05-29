import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { NavContext, type ScreenName } from './hooks/useNavigate';
import { PersonaContext, usePersonaState } from './hooks/usePersona';
import { PhoneFrame } from './components/layout/PhoneFrame';
import { HomeScreen } from './components/screens/HomeScreen';
import { GetPaidScreen } from './components/screens/GetPaidScreen';
import { ConfirmScreen } from './components/screens/ConfirmScreen';
import { EarningsScreen } from './components/screens/EarningsScreen';
import { ShiftsScreen } from './components/screens/ShiftsScreen';
import { SpendingScreen } from './components/screens/SpendingScreen';
import { SavingsScreen } from './components/screens/SavingsScreen';
import { BudgetScreen } from './components/screens/BudgetScreen';
import { LoansScreen } from './components/screens/LoansScreen';
import { BenefitsScreen } from './components/screens/BenefitsScreen';
import { PensionScreen } from './components/screens/PensionScreen';
import { CoachScreen } from './components/screens/CoachScreen';
import { WellbeingScreen } from './components/screens/WellbeingScreen';
import { DiscountsScreen } from './components/screens/DiscountsScreen';
import { PayslipsScreen } from './components/screens/PayslipsScreen';
import { SelfControlsScreen } from './components/screens/SelfControlsScreen';
import { NotificationsScreen } from './components/screens/NotificationsScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { LearningScreen } from './components/screens/LearningScreen';
import { TransferResultProvider } from './contexts/TransferResultContext';

// Confirm-step state is shared between GetPaid and Confirm — the
// transfer result lives in context so the Confirm screen can read
// it after the user submits. Implemented via TransferResultProvider.

const SCREENS: Record<ScreenName, () => ReactElement> = {
  home: HomeScreen,
  stream: GetPaidScreen,
  confirm: ConfirmScreen,
  track: EarningsScreen,
  shifts: ShiftsScreen,
  spend: SpendingScreen,
  save: SavingsScreen,
  budget: BudgetScreen,
  loans: LoansScreen,
  benefits: BenefitsScreen,
  pension: PensionScreen,
  coach: CoachScreen,
  wellbeing: WellbeingScreen,
  discounts: DiscountsScreen,
  payslip: PayslipsScreen,
  controls: SelfControlsScreen,
  notifications: NotificationsScreen,
  profile: ProfileScreen,
  learn: LearningScreen,
};

export default function App() {
  const personaState = usePersonaState();
  const [current, setCurrent] = useState<ScreenName>('home');
  const go = useCallback((name: ScreenName) => {
    setCurrent(name);
    // Mirror the original behaviour: scroll the phone body to top
    // on every navigation so deep links land at the heading rather
    // than wherever the user last was.
    requestAnimationFrame(() => {
      const el = document.getElementById('scroll-area');
      if (el) el.scrollTop = 0;
    });
  }, []);
  const nav = useMemo(() => ({ current, go }), [current, go]);
  const Screen = SCREENS[current];
  return (
    <PersonaContext.Provider value={personaState}>
      <NavContext.Provider value={nav}>
        <TransferResultProvider>
          <PhoneFrame>
            <Screen />
          </PhoneFrame>
        </TransferResultProvider>
      </NavContext.Provider>
    </PersonaContext.Provider>
  );
}
