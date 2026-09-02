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

  return normalizar(await getDocs(consulta));
}

/**
 * Agendamentos concluídos desde uma data, para as contas de cliente.
 *
 * Existe separada da consulta do mês porque recorrência e cliente sumido não
 * são perguntas sobre o mês que a tela mostra: "já era cliente antes?" precisa
 * do que veio antes, e "há quantos dias sumiu?" se conta a partir de hoje. Não
 * anda com as setas de mês, e por isso é buscada uma vez só.
 */
export async function buscarHistoricoDeClientes(
  shopId: string,
  desdeMs: number,
): Promise<AdminAppointment[]> {
  const db = getFirestore();

  const consulta = query(
    collection(db, 'shops', shopId, 'appointments'),
    where('status', '==', 'done'),
    where('startAtMs', '>=', desdeMs),
    orderBy('startAtMs'),
    limit(TETO),
  );

  return normalizar(await getDocs(consulta));
}

function normalizar(snap: { docs: QDoc[] }): AdminAppointment[] {
  return snap.docs
    .map((d: QDoc) => normalizeAdminAppointmentFromGlobal(d))
    .filter(Boolean) as AdminAppointment[];
}
