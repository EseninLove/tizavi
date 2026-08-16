import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTelegram } from '../lib/telegram';

interface SubscriptionContextValue {
  active: boolean;
  expiresAt: string | null;
  priceRub: number;
  days: number;
  loading: boolean;
  checked: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { webApp } = useTelegram();
  const [active, setActive] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [priceRub, setPriceRub] = useState(199);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    const initData = webApp?.initData;
    if (!initData) {
      setLoading(false);
      setChecked(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      const data = await res.json();
      if (data.ok) {
        setActive(!!data.active);
        setExpiresAt(data.expiresAt || null);
        if (data.priceRub) setPriceRub(data.priceRub);
        if (data.days) setDays(data.days);
      }
    } catch {
      // статус неизвестен — считаем неактивной
      setActive(false);
    } finally {
      setLoading(false);
      setChecked(true);
    }
  }, [webApp]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({ active, expiresAt, priceRub, days, loading, checked, refresh }),
    [active, expiresAt, priceRub, days, loading, checked, refresh]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
