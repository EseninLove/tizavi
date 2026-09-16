import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'tizavi-theme';

const PALETTES: Record<Theme, Record<string, string>> = {
  dark: {
    '--tg-bg': '#061a0c',
    '--tg-text': '#ffffff',
    '--tg-hint': '#93c39d',
    '--tg-link': '#2fce63',
    '--tg-button': '#ffffff',
    '--tg-button-text': '#0b2a13',
    '--tg-secondary-bg': '#1a6b2e',
    '--tg-section-bg': '#123a1e',
    '--tg-separator': '#1f5029',
    '--app-bg': 'linear-gradient(180deg, #061a0c 0%, #0e3016 45%, #1a6b2e 100%)',
    header: '#061a0c',
    button: '#ffffff',
    buttonText: '#0b2a13',
  },
  light: {
    '--tg-bg': '#e3efe6',
    '--tg-text': '#0d2313',
    '--tg-hint': '#5c7d64',
    '--tg-link': '#17803c',
    '--tg-button': '#1a8a3e',
    '--tg-button-text': '#ffffff',
    '--tg-secondary-bg': '#ddebdf',
    '--tg-section-bg': '#ffffff',
    '--tg-separator': '#d2e2d6',
    '--app-bg': 'linear-gradient(180deg, #e3efe6 0%, #eff7f1 55%, #f7fbf8 100%)',
    header: '#e3efe6',
    button: '#1a8a3e',
    buttonText: '#ffffff',
  },
};

function applyTheme(theme: Theme) {
  const palette = PALETTES[theme];
  const root = document.documentElement;
  Object.entries(palette).forEach(([key, value]) => root.style.setProperty(key, value));

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', palette.header);

  const tg = window.Telegram?.WebApp;
  if (tg) {
    try {
      tg.setHeaderColor(palette.header);
      tg.setBackgroundColor(palette.header);
    } catch {
      // ignore
    }
    try {
      tg.MainButton.setParams({ color: palette.button, text_color: palette.buttonText });
    } catch {
      // ignore
    }
  }
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  );

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return (
    useContext(ThemeContext) ?? {
      theme: 'dark' as Theme,
      setTheme: () => {},
      toggleTheme: () => {},
    }
  );
}
