import { create } from 'zustand';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

type AuthState = {
  user: FirebaseAuthTypes.User | null;
  initializing: boolean;
  setUser: (user: FirebaseAuthTypes.User | null) => void;
  setInitializing: (initializing: boolean) => void;
};

/**
 * Estado de autenticação (usuário logado). Alimentado pelo AuthProvider, que
 * assina o Firebase Auth. A fonte de verdade continua o Firebase.
 */
export const useAuthStore = create<AuthState>(set => ({
  user: null,
  initializing: true,
  setUser: user => set({ user }),
  setInitializing: initializing => set({ initializing }),
}));
