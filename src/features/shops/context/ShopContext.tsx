import React, { useEffect } from 'react';
import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';
import { useAuth, useMeStore, type MeDoc } from '@features/auth';

import {
  useShopStore,
  computeSubscription,
  type ShopDoc,
  type UserRole,
  type SubscriptionStatus,
} from '../state/shop.store';

export type { ShopDoc, UserRole, SubscriptionStatus };

/**
 * Inicializador da estética vinculada: assina users/{uid} (role + shopId) e
 * shops/{shopId} (doc do shop) e grava no useShopStore. Mantido como "Provider"
 * por compatibilidade com o App.tsx, mas não usa mais Context.
 */
export function ShopProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const db = getFirestore();

  // users/{uid} → único listener do doc do próprio usuário. Alimenta o
  // useShopStore (shopId + role, p/ navegação) e o useMeStore (perfil + foto),
  // substituindo os listeners duplicados que viviam nas telas.
  useEffect(() => {
    if (!user?.uid) {
      useShopStore.getState().reset();
      useMeStore.getState().reset();
      return;
    }

    const uid = user.uid;
    useShopStore.getState().setLoadingUser(true);
    useMeStore.getState().setLoadingMe(true);

    const unsub = onSnapshot(
      doc(db, 'users', uid),
      snap => {
        const data = (snap.data() ?? {}) as Partial<MeDoc>;
        useShopStore.getState().setUserSnapshot({
          shopId: data.shopId ?? null,
          userRole: data.role ?? null,
        });
        useMeStore.getState().setMe({ ...data, uid });
      },
      () => {
        useShopStore.getState().setLoadingUser(false);
        useMeStore.getState().setLoadingMe(false);
      },
    );

    return unsub;
  }, [db, user?.uid]);

  // shops/{shopId} → shop doc
  const shopId = useShopStore(state => state.shopId);

  useEffect(() => {
    const store = useShopStore.getState();

    if (!shopId) {
      store.setShop(null);
      return;
    }

    store.setLoadingShop(true);

    const unsub = onSnapshot(
      doc(db, 'shops', shopId),
      snap => {
        if (snap.exists()) {
          useShopStore.getState().setShop({ id: snap.id, ...(snap.data() as Omit<ShopDoc, 'id'>) });
        } else {
          useShopStore.getState().setShop(null);
        }
      },
      () => useShopStore.getState().setLoadingShop(false),
    );

    return unsub;
  }, [db, shopId]);

  return <>{children}</>;
}

/**
 * Mesma API de antes. Lê do useShopStore e deriva loading + assinatura.
 */
export function useShop() {
  const shopId = useShopStore(state => state.shopId);
  const shop = useShopStore(state => state.shop);
  const userRole = useShopStore(state => state.userRole);
  const loadingUser = useShopStore(state => state.loadingUser);
  const loadingShop = useShopStore(state => state.loadingShop);

  const loading = loadingUser || loadingShop;
  const { isSubscriptionActive, trialDaysLeft, isInGrace } = computeSubscription(shop);

  return { shopId, shop, userRole, loading, isSubscriptionActive, trialDaysLeft, isInGrace };
}
