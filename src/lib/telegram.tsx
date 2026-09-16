import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { TelegramUser } from '../types';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  MainButton: {
    text: string;
    isVisible: boolean;
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    setParams: (params: Record<string, unknown>) => void;
  };
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  openInvoice: (url: string, cb: (status: string) => void) => void;
  showAlert: (message: string, cb?: () => void) => void;
  showConfirm: (message: string, cb?: (ok: boolean) => void) => void;
  showPopup: (
    params: { title?: string; message: string; buttons?: Array<{ id?: string; text: string }> },
    cb?: (id: string) => void
  ) => void;
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  onEvent: (event: string, cb: () => void) => void;
  offEvent: (event: string, cb: () => void) => void;
}

interface TelegramContextValue {
  webApp: TelegramWebApp | null;
  user: TelegramUser | null;
  colorScheme: 'light' | 'dark';
  haptic: {
    impact: (style?: 'light' | 'medium' | 'heavy') => void;
    notify: (type: 'success' | 'error' | 'warning') => void;
    select: () => void;
  };
}

const TelegramContext = createContext<TelegramContextValue | null>(null);

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    tg.ready();
    tg.expand();
    setWebApp(tg);

    // Брендовая тёмно-зелёная палитра (по логотипу) — игнорируем тему Telegram
    const BRAND = {
      bg: '#0b2a13',
      text: '#ffffff',
      hint: '#93c39d',
      link: '#2fce63',
      button: '#ffffff',
      buttonText: '#0b2a13',
      secondaryBg: '#1a6b2e',
      sectionBg: '#123a1e',
      separator: '#1f5029',
    };

    const applyTheme = () => {
      const root = document.documentElement;
      root.style.setProperty('--tg-bg', BRAND.bg);
      root.style.setProperty('--tg-text', BRAND.text);
      root.style.setProperty('--tg-hint', BRAND.hint);
      root.style.setProperty('--tg-link', BRAND.link);
      root.style.setProperty('--tg-button', BRAND.button);
      root.style.setProperty('--tg-button-text', BRAND.buttonText);
      root.style.setProperty('--tg-secondary-bg', BRAND.secondaryBg);
      root.style.setProperty('--tg-section-bg', BRAND.sectionBg);
      root.style.setProperty('--tg-separator', BRAND.separator);

      try {
        tg.setHeaderColor(BRAND.bg);
        tg.setBackgroundColor(BRAND.bg);
      } catch {
        // ignore
      }

      try {
        tg.MainButton.setParams({ color: BRAND.button, text_color: BRAND.buttonText });
      } catch {
        // ignore
      }
    };

    applyTheme();
    tg.onEvent('themeChanged', applyTheme);

    return () => {
      tg.offEvent('themeChanged', applyTheme);
    };
  }, []);

  const value = useMemo<TelegramContextValue>(
    () => ({
      webApp,
      user: webApp?.initDataUnsafe?.user ?? null,
      colorScheme: webApp?.colorScheme ?? 'light',
      haptic: {
        impact: (style = 'light') => webApp?.HapticFeedback?.impactOccurred(style),
        notify: (type) => webApp?.HapticFeedback?.notificationOccurred(type),
        select: () => webApp?.HapticFeedback?.selectionChanged(),
      },
    }),
    [webApp]
  );

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}

export function useTelegram(): TelegramContextValue {
  const ctx = useContext(TelegramContext);
  if (!ctx) {
    return {
      webApp: null,
      user: null,
      colorScheme: 'light',
      haptic: {
        impact: () => {},
        notify: () => {},
        select: () => {},
      },
    };
  }
  return ctx;
}
