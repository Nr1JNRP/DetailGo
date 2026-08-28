import { create } from 'zustand';

export type UserRole = 'owner' | 'customer';
export type SubscriptionStatus = 'trial' | 'active' | 'inactive';

export type ShopDoc = {
  id: string;
  name: string;
  ownerId: string;
  createdAt?: any;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: any; // Firestore Timestamp
  activeUntil?: any; // Firestore Timestamp
  location?: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    geohash: string;
  } | null;
  geohash?: string | null;
  isVisibleOnMap?: boolean;
};

type ShopState = {
  shopId: string | null;
  shop: ShopDoc | null;
  userRole: UserRole | null;
  loadingUser: boolean;
  loadingShop: boolean;
  setUserSnapshot: (data: { shopId: string | null; userRole: UserRole | null }) => void;
  setShop: (shop: ShopDoc | null) => void;
  setLoadingUser: (loading: boolean) => void;
  setLoadingShop: (loading: boolean) => void;
  reset: () => void;
};

/**
 * Estado da estética vinculada ao usuário (shop, role, assinatura). Alimentado
 * pelo ShopProvider via listeners do Firestore (users/{uid} e shops/{shopId}).
 * A fonte de verdade continua o Firestore.
 */
export const useShopStore = create<ShopState>(set => ({
  shopId: null,
  shop: null,
  userRole: null,
  loadingUser: true,
  loadingShop: false,
  setUserSnapshot: ({ shopId, userRole }) => set({ shopId, userRole, loadingUser: false }),
  setShop: shop => set({ shop, loadingShop: false }),
  setLoadingUser: loadingUser => set({ loadingUser }),
  setLoadingShop: loadingShop => set({ loadingShop }),
  reset: () =>
    set({ shopId: null, shop: null, userRole: null, loadingUser: false, loadingShop: false }),
}));

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Dias que o dono continua entrando depois do vencimento.
 *
 * Cartão vencido é problema banal, e o Asaas retenta a cobrança nesse
 * intervalo. Derrubar a agenda no meio do expediente, com clientes marcados,
 * perde o assinante por um contratempo de banco.
 */
export const GRACE_DAYS = 5;

export type SubscriptionState = {
  isSubscriptionActive: boolean;
  trialDaysLeft: number;
  /** Vencida, mas ainda dentro da carência: entra com aviso de pendência. */
  isInGrace: boolean;
};

/** Calcula se a assinatura está ativa e quantos dias de trial restam. */
export function computeSubscription(shop: ShopDoc | null, now = Date.now()): SubscriptionState {
  const bloqueado = { isSubscriptionActive: false, trialDaysLeft: 0, isInGrace: false };

  if (!shop) return bloqueado;

  if (shop.subscriptionStatus === 'trial') {
    const endsAt = shop.trialEndsAt?.toMillis?.() ?? 0;
    const daysLeft = Math.max(0, Math.ceil((endsAt - now) / DIA_MS));
    return { isSubscriptionActive: daysLeft > 0, trialDaysLeft: daysLeft, isInGrace: false };
  }

  if (shop.subscriptionStatus === 'active') {
    const until = shop.activeUntil?.toMillis?.() ?? 0;
    if (until > now) {
      return { isSubscriptionActive: true, trialDaysLeft: 0, isInGrace: false };
    }

    const dentroDaCarencia = now <= until + GRACE_DAYS * DIA_MS;
    return {
      isSubscriptionActive: dentroDaCarencia,
      trialDaysLeft: 0,
      isInGrace: dentroDaCarencia,
    };
  }

  return bloqueado;
}
