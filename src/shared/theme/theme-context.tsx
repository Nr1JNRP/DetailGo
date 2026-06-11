import React from 'react';

import { darkColors, lightColors } from './colors';
import { useThemeStore, type ThemeMode } from './theme.store';

export type { ThemeMode };

/**
 * Mantido por compatibilidade (App.tsx). O estado do tema agora vive no
 * useThemeStore (Zustand + persist), então o provider é só um passthrough —
 * a hidratação do AsyncStorage é automática.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * Hook de tema com a mesma API de antes. Lê o modo do useThemeStore e deriva
 * as cores. Os consumidores (useAppTheme) não mudam.
 */
export function useAppTheme() {
  const mode = useThemeStore(state => state.mode);
  const setMode = useThemeStore(state => state.setMode);
  const toggleTheme = useThemeStore(state => state.toggleTheme);

  const isLight = mode === 'light';

  return {
    mode,
    colors: isLight ? lightColors : darkColors,
    isLight,
    setMode,
    toggleTheme,
  };
}
