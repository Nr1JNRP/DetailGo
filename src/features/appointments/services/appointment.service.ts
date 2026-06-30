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
import { ACTIVE_APPOINTMENT_SET } from '../domain/appointment.constants';
import { isExpiredScheduled } from '../domain/appointment.helpers';
import { mapFirestoreError } from '@shared/utils/firebase.utils';

export type CancelAppointmentResult =
  | { ok: true; message: string; data?: any }
  | { ok: false; message: string; code?: string };

export function getAppointmentRules(appointment: {
  status: AppointmentStatus;
  startAtMs: number;
}): {
  canCancel: boolean;
  isExpired: boolean;
  message?: string;
} {
  if (appointment.status === 'scheduled') {
    // Passou do horário (+ tolerância) e o estabelecimento ainda não deu baixa:
    // não é cancelamento. O cliente só cancela enquanto o agendamento é futuro.
    if (isExpiredScheduled(appointment.status, appointment.startAtMs)) {
      return {
        canCancel: false,
        isExpired: true,
        message: 'Este horário já passou. Aguarde a confirmação do estabelecimento.',
      };
    }
    return { canCancel: true, isExpired: false };
  }

  const messages: Record<Exclude<AppointmentStatus, 'scheduled'>, string> = {
    cancelled: 'Este agendamento foi cancelado.',
    no_show: 'Você não compareceu a este agendamento.',
    done: 'Este serviço já foi realizado.',
    in_progress: 'Serviço em andamento não pode ser cancelado.',
  };

  return { canCancel: false, isExpired: false, message: messages[appointment.status] };
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
      const data = d.data() as { status?: AppointmentStatus; startAtMs?: number };
      if (!data.status || !activeStatuses.has(data.status)) return false;
      // Vencido (scheduled que passou do horário + tolerância) não segura o vínculo.
      return !isExpiredScheduled(data.status, data.startAtMs ?? 0);
    });

    if (hasActive) return;

    await setDoc(doc(db, 'users', customerUid), { shopId: null }, { merge: true });
  } catch {
    // Não interrompe a ação principal se a limpeza auxiliar falhar.
  }
}
