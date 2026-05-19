import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';
import { useAuth } from '@features/auth';

export type UserRole = 'owner' | 'customer';
export type SubscriptionStatus = 'trial' | 'active' | 'inactive';

export type ShopDoc = {
  id: string;
  name: string;
  code: string;
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

type UserDoc = {
  shopId?: string;
  role?: UserRole;
};

type ShopContextValue = {
  shopId: string | null;
  shop: ShopDoc | null;
  userRole: UserRole | null;
  loading: boolean;
  isSubscriptionActive: boolean;
  trialDaysLeft: number;
};

const ShopContext = createContext<ShopContextValue | undefined>(undefined);

function computeSubscription(shop: ShopDoc | null): {
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

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const db = getFirestore();

  const [shopId, setShopId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [shop, setShop] = useState<ShopDoc | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingShop, setLoadingShop] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setShopId(null);
      setUserRole(null);
      setShop(null);
      setLoadingUser(false);
      return;
    }

    setLoadingUser(true);

    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      snap => {
        const data = (snap.data() ?? {}) as UserDoc;
        setShopId(data.shopId ?? null);
        setUserRole(data.role ?? null);
        setLoadingUser(false);
      },
      () => setLoadingUser(false),
    );

    return unsub;
  }, [db, user?.uid]);

  useEffect(() => {
    if (!shopId) {
      setShop(null);
      setLoadingShop(false);
      return;
    }

    setLoadingShop(true);

    const unsub = onSnapshot(
      doc(db, 'shops', shopId),
      snap => {
        if (snap.exists()) {
          setShop({ id: snap.id, ...(snap.data() as Omit<ShopDoc, 'id'>) });
        } else {
          setShop(null);
        }
        setLoadingShop(false);
      },
      () => setLoadingShop(false),
    );

    return unsub;
  }, [db, shopId]);

  const loading = loadingUser || loadingShop;
  const { isSubscriptionActive, trialDaysLeft } = computeSubscription(shop);

  const value = useMemo<ShopContextValue>(
    () => ({ shopId, shop, userRole, loading, isSubscriptionActive, trialDaysLeft }),
    [shopId, shop, userRole, loading, isSubscriptionActive, trialDaysLeft],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop deve ser usado dentro de <ShopProvider>');
  return ctx;
}
