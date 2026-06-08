import { AppointmentStatus } from '@features/appointments';
import { NO_SHOW_GRACE_MS } from '@features/appointments';
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  updateDoc,
} from '@react-native-firebase/firestore';

/**
 * Atualiza o status de um agendamento. O owner escreve apenas no doc do shop
 * (que ele tem permissão). A cópia do cliente em users/{customerUid}/appointments
 * é sincronizada pela Cloud Function onAppointmentStatusChanged — o owner não
 * pode escrever na subcoleção de outro usuário (regras do Firestore).
 */
export async function updateAppointmentStatus(params: {
  shopId: string;
  appointmentId: string;
  status: AppointmentStatus;
}) {
  const db = getFirestore();
  const { shopId, appointmentId, status } = params;

  const globalRef = doc(db, 'shops', shopId, 'appointments', appointmentId);
  const globalSnap = await getDoc(globalRef);
  const globalData = (globalSnap.data() ?? {}) as any;

  const startAtMs = Number(globalData.startAtMs ?? 0);
  const currentStatus = (globalData.status ?? 'scheduled') as AppointmentStatus;

  if (startAtMs) {
    const expired = Date.now() >= startAtMs + NO_SHOW_GRACE_MS;

    if (
      expired &&
      currentStatus === 'scheduled' &&
      (status === 'in_progress' || status === 'done')
    ) {
      const err: any = new Error('Agendamento expirado. Deve ser marcado como não realizado.');
      err.code = 'APPOINTMENT_EXPIRED';
      throw err;
    }
  }

  const payload: Record<string, any> = {
    status,
    updatedAt: serverTimestamp(),
    ...(status === 'in_progress' && { startedAt: serverTimestamp() }),
    ...(status === 'done' && { doneAt: serverTimestamp() }),
    ...(status === 'no_show' && { noShowAt: serverTimestamp() }),
  };

  await updateDoc(globalRef, payload);
}
