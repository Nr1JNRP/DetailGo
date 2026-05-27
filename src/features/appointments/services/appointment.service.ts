import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import type { AppointmentStatus } from '../domain/appointment.types';
import { ACTIVE_APPOINTMENT_SET, NO_SHOW_GRACE_MS } from '../domain/appointment.constants';
import { mapFirestoreError } from '@shared/utils/firebase.utils';

export type CancelAppointmentResult =
  | { ok: true; message: string; data?: any }
  | { ok: false; message: string; code?: string };

export function getAppointmentRules(appointment: {
  status: AppointmentStatus;
  startAtMs: number;
}): {
  canCancel: boolean;
  canReschedule: boolean;
  message?: string;
  isExpired: boolean;
} {
  const now = Date.now();
  const isExpired = now >= appointment.startAtMs;

  if (appointment.status === 'cancelled') {
    return {
      canCancel: false,
      canReschedule: false,
      isExpired: true,
      message: 'Este agendamento foi cancelado por você.',
    };
  }

  if (appointment.status === 'no_show') {
    return {
      canCancel: false,
      canReschedule: true,
      isExpired: true,
      message: 'Você não compareceu a este agendamento. Pode reagendar.',
    };
  }

  if (appointment.status === 'done') {
    return {
      canCancel: false,
      canReschedule: false,
      isExpired: true,
      message: 'Este serviço já foi realizado.',
    };
  }

  if (appointment.status === 'in_progress') {
    return {
      canCancel: false,
      canReschedule: false,
      isExpired: true,
      message: 'Serviço em andamento não pode ser alterado.',
    };
  }

  if (appointment.status === 'scheduled') {
    const passedTime = now >= appointment.startAtMs;
    return {
      canCancel: !passedTime,
      canReschedule: true,
      isExpired: passedTime,
      message: passedTime ? 'Horário já passou. Você pode reagendar, mas não cancelar.' : undefined,
    };
  }

  return { canCancel: false, canReschedule: false, isExpired };
}

export async function cancelAppointment(
  appointmentId: string,
  customerUid: string,
  shopId: string,
): Promise<CancelAppointmentResult> {
  try {
    const db = getFirestore();
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return { ok: false, message: 'Você precisa estar logado.' };
    }

    if (currentUser.uid !== customerUid) {
      return { ok: false, message: 'Permissão negada.' };
    }

    const appointmentRef = doc(db, 'shops', shopId, 'appointments', appointmentId);
    const appointmentSnap = await getDoc(appointmentRef);

    if (!appointmentSnap.exists) {
      return { ok: false, message: 'Agendamento não encontrado.' };
    }

    const appointmentData = appointmentSnap.data() as {
      status: AppointmentStatus;
      startAtMs: number;
    };

    const rules = getAppointmentRules(appointmentData);
    if (!rules.canCancel) {
      return {
        ok: false,
        message: rules.message || 'Não é possível cancelar este agendamento.',
      };
    }

    const userAppointmentRef = doc(db, 'users', customerUid, 'appointments', appointmentId);
    const batch = writeBatch(db);

    batch.update(appointmentRef, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancelledBy: currentUser.uid,
      updatedAt: serverTimestamp(),
    });

    batch.update(userAppointmentRef, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancelledBy: currentUser.uid,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    // Se o cliente não tem mais agendamentos ativos no shop, desvincula a estética
    // favorita (users/{uid}.shopId = null) para voltar ao empty state no Dashboard.
    await clearShopFavoriteIfNoActive(customerUid, shopId);

    return { ok: true, message: 'Agendamento cancelado com sucesso!' };
  } catch (error: any) {
    return { ok: false, message: mapFirestoreError(error) };
  }
}

export async function markExpiredScheduledAppointmentsAsNoShow(
  customerUid: string,
  shopId: string,
): Promise<number> {
  try {
    const db = getFirestore();
    const now = Date.now();

    const userAppointmentsQuery = query(
      collection(db, 'shops', shopId, 'appointments'),
      where('customerUid', '==', customerUid),
    );

    const snap = await getDocs(userAppointmentsQuery);
    const expired = snap.docs.filter((d: { data: () => unknown }) => {
      const data = d.data() as { status?: AppointmentStatus; startAtMs?: number };
      const startAtMs = Number(data.startAtMs ?? 0);
      return data.status === 'scheduled' && startAtMs > 0 && now >= startAtMs + NO_SHOW_GRACE_MS;
    });

    if (expired.length === 0) return 0;

    const batch = writeBatch(db);

    expired.forEach((d: any) => {
      const payload = {
        status: 'no_show' as AppointmentStatus,
        noShowAt: serverTimestamp(),
        noShowReason: 'auto_expired',
        updatedAt: serverTimestamp(),
      };

      batch.update(d.ref, payload);
      batch.set(doc(db, 'users', customerUid, 'appointments', d.id), payload, { merge: true });
    });

    await batch.commit();
    await clearShopFavoriteIfNoActive(customerUid, shopId);

    return expired.length;
  } catch {
    return 0;
  }
}

/**
 * Verifica se o cliente ainda tem agendamentos ativos no shop. Se não tem,
 * limpa users/{uid}.shopId para o Dashboard voltar ao empty state.
 *
 * Estratégia: busca todos os agendamentos do user no shop e filtra status
 * no cliente. Evita where('status', 'in', [...]) que exigiria índice composto.
 */
export async function clearShopFavoriteIfNoActive(
  customerUid: string,
  shopId: string,
): Promise<void> {
  try {
    const db = getFirestore();

    const userSnap = await getDoc(doc(db, 'users', customerUid));
    if (!userSnap.exists()) return;

    const userData = userSnap.data() as { shopId?: string | null };

    if (userData.shopId !== shopId) return;

    const userAppointmentsQuery = query(
      collection(db, 'shops', shopId, 'appointments'),
      where('customerUid', '==', customerUid),
    );

    const snap = await getDocs(userAppointmentsQuery);
    const activeStatuses = new Set<AppointmentStatus>(ACTIVE_APPOINTMENT_SET);

    const hasActive = snap.docs.some((d: { data: () => unknown }) => {
      const data = d.data() as { status?: AppointmentStatus };
      return data.status ? activeStatuses.has(data.status) : false;
    });

    if (hasActive) return;

    await setDoc(doc(db, 'users', customerUid), { shopId: null }, { merge: true });
  } catch {
    // Não interrompe a ação principal se a limpeza auxiliar falhar.
  }
}
