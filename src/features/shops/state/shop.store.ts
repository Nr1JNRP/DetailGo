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

/** Calcula se a assinatura está ativa e quantos dias de trial restam. */
export function computeSubscription(shop: ShopDoc | null): {
  isSubscriptionActive: boolean;
  trialDaysLeft: number;
} {
  if (!shop) return { isSubscriptionActive: false, trialDaysLeft: 0 };

  const now = Date.now();

  if (shop.subscriptionStatus === 'trial') {
    const endsAt = shop.trialEndsAt?.toMillis?.() ?? 0;
    const msLeft = endsAt - now;
    const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    return { isSubscriptionActive: daysLeft > 0, trialDaysLeft: daysLeft };
  }

  if (shop.subscriptionStatus === 'active') {
    const until = shop.activeUntil?.toMillis?.() ?? 0;
    return { isSubscriptionActive: until > now, trialDaysLeft: 0 };
  }

  return { isSubscriptionActive: false, trialDaysLeft: 0 };
}
