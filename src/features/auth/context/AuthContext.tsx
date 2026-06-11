import React, { useEffect } from 'react';
import {
  subscribeAuth,
  signIn as svcSignIn,
  register as svcRegister,
  signOutUser as svcSignOut,
  type RegisterInput,
} from '../services/auth.service';
import { useAuthStore } from '../state/auth.store';

export type { RegisterInput };

/**
 * Inicializador da sessão de auth: assina o Firebase Auth e grava o usuário no
 * useAuthStore (Zustand). Mantido como "Provider" por compatibilidade com o
 * App.tsx, mas não usa mais Context — o estado vive no store.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unsub = subscribeAuth(u => {
      useAuthStore.getState().setUser(u);
      useAuthStore.getState().setInitializing(false);
    });
    return unsub;
  }, []);

  return <>{children}</>;
}

/**
 * Mesma API de antes. Lê user/initializing do store e mantém as ações.
 */
export function useAuth() {
  const user = useAuthStore(state => state.user);
  const initializing = useAuthStore(state => state.initializing);

  const signIn = async (email: string, password: string) => {
    const res = await svcSignIn(email, password);
    return res.ok ? { ok: true } : { ok: false, message: res.message };
  };

  const register = async (data: RegisterInput) => {
    const res = await svcRegister(data);
    return res.ok ? { ok: true } : { ok: false, message: res.message };
  };

  const signOut = async () => {
    await svcSignOut();
  };

  return { user, initializing, signIn, register, signOut };
}
