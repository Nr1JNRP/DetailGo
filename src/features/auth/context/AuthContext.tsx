import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  subscribeAuth,
  signIn as svcSignIn,
  register as svcRegister,
  signOutUser as svcSignOut,
  type RegisterInput,
} from '../services/auth.service';

export type { RegisterInput };

type AuthContextValue = {
  user: FirebaseAuthTypes.User | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  register: (data: RegisterInput) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = subscribeAuth(u => {
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const res = await svcSignIn(email, password);
    if (!res.ok) return { ok: false, message: res.message };
    return { ok: true };
  };

  const register: AuthContextValue['register'] = async data => {
    const res = await svcRegister(data);
    if (!res.ok) return { ok: false, message: res.message };
    return { ok: true };
  };

  const signOut = async () => {
    await svcSignOut();
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, initializing, signIn, register, signOut }),
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
