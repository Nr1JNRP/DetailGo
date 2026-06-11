import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light';

type ThemeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

/**
 * Estado do tema com persistência (AsyncStorage). Substitui o antigo
 * ThemeContext + AsyncStorage manual. Padrão: tema escuro.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({
      mode: 'dark',
      setMode: mode => set({ mode }),
      toggleTheme: () => set(state => ({ mode: state.mode === 'light' ? 'dark' : 'light' })),
    }),
    {
      name: '@detailgo/theme-mode',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
