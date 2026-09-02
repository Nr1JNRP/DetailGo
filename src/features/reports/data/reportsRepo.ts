import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

import type { AdminAppointment } from '@features/admin';
import { normalizeAdminAppointmentFromGlobal } from '@features/admin';
import type { LimitesDoMes } from '../domain/periodo';

type QDoc = FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>;

/**
 * Teto de segurança. Uma estética não faz 2000 serviços num mês; se fizer, o
 * relatório mostra os 2000 primeiros em vez de o app travar baixando tudo.
 */
const TETO = 2000;

/**
 * Agendamentos concluídos de um mês.
 *
 * Leitura pontual, sem listener: relatório de mês fechado não muda, e o do mês
 * corrente não precisa reagir ao vivo enquanto o dono olha o gráfico.
 */
export async function buscarConcluidosDoMes(
  shopId: string,
  { inicioMs, fimMs }: LimitesDoMes,
): Promise<AdminAppointment[]> {
  const db = getFirestore();

  const consulta = query(
    collection(db, 'shops', shopId, 'appointments'),
    where('status', '==', 'done'),
    where('startAtMs', '>=', inicioMs),
    where('startAtMs', '<', fimMs),
    orderBy('startAtMs'),
    limit(TETO),
  );

  const snap = await getDocs(consulta);

  return snap.docs
    .map((d: QDoc) => normalizeAdminAppointmentFromGlobal(d))
    .filter(Boolean) as AdminAppointment[];
}
