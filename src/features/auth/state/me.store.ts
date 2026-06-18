import { create } from 'zustand';

/**
 * Documento do próprio usuário logado (users/{uid}). Reúne perfil + papel +
 * shopId num único lugar. É alimentado por UM único listener (no ShopProvider),
 * substituindo os 5 listeners que antes liam users/{uid} separadamente
 * (ShopContext, DashboardScreen, ProfileScreen, AdminDashboard, AdminDrawer).
 */
export type MeDoc = {
  uid: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  pendingEmail?: string;
  photoURL?: string;
  photoB64?: string;
  role?: 'owner' | 'customer';
  shopId?: string;
};

type MeState = {
  me: MeDoc | null;
  loadingMe: boolean;
  setMe: (me: MeDoc | null) => void;
  setLoadingMe: (loading: boolean) => void;
  reset: () => void;
};

export const useMeStore = create<MeState>(set => ({
  me: null,
  loadingMe: true,
  setMe: me => set({ me, loadingMe: false }),
  setLoadingMe: loadingMe => set({ loadingMe }),
  reset: () => set({ me: null, loadingMe: false }),
}));
