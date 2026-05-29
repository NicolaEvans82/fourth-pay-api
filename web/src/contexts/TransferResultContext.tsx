import { createContext, useContext, useState, type ReactNode } from 'react';
import type { TransferResult } from '../types/api';

interface Ctx {
  lastResult: TransferResult | null;
  requestedAmount: number | null;
  setResult: (result: TransferResult, requestedAmount: number) => void;
}

const TransferResultContext = createContext<Ctx | null>(null);

export function TransferResultProvider({ children }: { children: ReactNode }) {
  const [lastResult, setLastResult] = useState<TransferResult | null>(null);
  const [requestedAmount, setRequestedAmount] = useState<number | null>(null);
  const setResult = (result: TransferResult, amt: number) => {
    setLastResult(result);
    setRequestedAmount(amt);
  };
  return (
    <TransferResultContext.Provider value={{ lastResult, requestedAmount, setResult }}>
      {children}
    </TransferResultContext.Provider>
  );
}

export function useTransferResult(): Ctx {
  const ctx = useContext(TransferResultContext);
  if (!ctx) throw new Error('useTransferResult must be inside <TransferResultProvider>');
  return ctx;
}
