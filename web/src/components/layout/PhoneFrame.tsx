import type { ReactNode } from 'react';
import { StatusBar } from './StatusBar';
import { BottomNav } from './BottomNav';

interface Props {
  children: ReactNode;
}

// The dark phone frame wrapper. Holds the status bar at the top and
// the bottom nav at the bottom; the middle is the scrolling screen
// area where each Screen component renders.
export function PhoneFrame({ children }: Props) {
  return (
    <div className="phone-frame">
      <div className="app">
        <StatusBar />
        <div className="scroll-area" id="scroll-area">
          {children}
        </div>
        <BottomNav />
      </div>
    </div>
  );
}
