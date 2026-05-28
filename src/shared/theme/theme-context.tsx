import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { darkColors, lightColors, type AppColors } from './colors';

export type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = '@detailgo/theme-mode';

const isThemeMode = (value: unknown): value is ThemeMode => value === 'dark' || value === 'light';

type ThemeContextValue = {
  mode: ThemeMode;
  colors: AppColors;
  isLight: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    let mounted = true;

    async function loadStoredTheme() {
      try {
        const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);

        if (mounted && isThemeMode(storedTheme)) {
          setMode(storedTheme);
        }
      } catch {
        // Keep the default dark theme if local storage is unavailable.
      }
    }

    loadStoredTheme();

    return () => {
      mounted = false;
    };
  }, []);

  const persistMode = useCallback((nextMode: ThemeMode) => {
    setMode(nextMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch(() => undefined);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(current => {
      const nextMode = current === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch(() => undefined);
      return nextMode;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const isLight = mode === 'light';
    return {
      mode,
      colors: isLight ? lightColors : darkColors,
      isLight,
      setMode: persistMode,
      toggleTheme,
    };
  }, [mode, persistMode, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme deve ser usado dentro de ThemeProvider');
  }

  return context;
}
