import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from '@react-native-firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
  collection,
  Timestamp,
} from '@react-native-firebase/firestore';
import { mapFirebaseAuthError } from '@shared/utils/firebase.utils';
import { generateGeohash } from '@shared/utils/geo.utils';
import type { ShopLocation } from '@features/shops/domain/shopLocation.types';

export type UserRole = 'owner' | 'customer';

export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  shopName?: string; // obrigatório para owner
  shopLocation?: ShopLocation; // obrigatório para owner
};

export type AuthResult =
  | {
      ok: true;
      user: FirebaseAuthTypes.User;
      cred?: FirebaseAuthTypes.UserCredential;
    }
  | { ok: false; message: string; code?: string };

const TRIAL_DAYS = 7;

async function registerAsOwner(uid: string, data: RegisterInput): Promise<void> {
  const db = getFirestore();
  const shopRef = doc(collection(db, 'shops'));
  const shopId = shopRef.id;
  const shopName = data.shopName?.trim() || 'Minha Estética';

  const trialEndsAt = Timestamp.fromMillis(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const location = data.shopLocation ?? null;
  const geohash = location ? generateGeohash(location.lat, location.lng) : null;

  // Documento principal do shop
  await setDoc(shopRef, {
    name: shopName,
    ownerId: uid,
    createdAt: serverTimestamp(),
    subscriptionStatus: 'trial',
    trialEndsAt,
    activeUntil: null,
    location: location
      ? {
          lat: location.lat,
          lng: location.lng,
          address: location.address,
          city: location.city,
          geohash,
        }
      : null,
    geohash,
    isVisibleOnMap: true, // controle de visibilidade independente da assinatura
  });

  // Configurações padrão do shop
  await setDoc(doc(db, 'shops', shopId, 'settings', 'config'), {
    openHour: 8,
    closeHour: 18,
    parallelCapacity: 2,
    workingDays: ['seg', 'ter', 'qua', 'qui', 'sex'],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Vincula o usuário ao shop como owner
  await setDoc(
    doc(db, 'users', uid),
    {
      uid,
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      email: data.email,
      phone: data.phone ?? '',
      role: 'owner',
      shopId,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

async function registerAsCustomer(uid: string, data: RegisterInput): Promise<void> {
  const db = getFirestore();
  await setDoc(
    doc(db, 'users', uid),
    {
      uid,
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      email: data.email,
      phone: data.phone ?? '',
      role: 'customer',
      shopId: null,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const auth = getAuth();
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return { ok: true, user: cred.user, cred };
  } catch (e: any) {
    return {
      ok: false,
      message: mapFirebaseAuthError(e?.code, 'Erro ao autenticar.'),
      code: e?.code,
    };
  }
}

export async function register(data: RegisterInput): Promise<AuthResult> {
  try {
    const auth = getAuth();
    const cred = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);

    const displayName = `${data.firstName} ${data.lastName}`.trim();
    if (displayName) await updateProfile(cred.user, { displayName });

    if (data.role === 'owner') {
      await registerAsOwner(cred.user.uid, data);
      return { ok: true, user: cred.user, cred };
    } else {
      await registerAsCustomer(cred.user.uid, data);
      return { ok: true, user: cred.user, cred };
    }
  } catch (e: any) {
    return {
      ok: false,
      message: e?.message ?? mapFirebaseAuthError(e?.code, 'Erro ao criar conta.'),
      code: e?.code,
    };
  }
}

export async function signOutUser() {
  await signOut(getAuth());
}

export function getCurrentUser(): FirebaseAuthTypes.User | null {
  return getAuth().currentUser;
}

export function subscribeAuth(callback: (user: FirebaseAuthTypes.User | null) => void) {
  return onAuthStateChanged(getAuth(), callback);
}
