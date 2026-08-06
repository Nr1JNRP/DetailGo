import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
  runTransaction,
  doc,
  serverTimestamp,
  type FirebaseFirestoreTypes,
  getDoc,
} from '@react-native-firebase/firestore';

import { getShopSettings, type ShopSettings } from '@features/settings';
import type { VehicleType, CarCategory, AppointmentStatus } from '../domain/appointment.types';
import { ACTIVE_APPOINTMENT_SET } from '../domain/appointment.constants';
import { dateUtils } from '@shared/utils/date.utils';

type QDoc = FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>;

export type Slot = {
  startAtMs: number;
  endAtMs: number;
  durationMin: number;
};

export type AppointmentCreateInput = {
  shopId: string;
  customerUid: string;
  vehicleType: VehicleType;
  carCategory: CarCategory | null;
  serviceLabel: string;
  durationMin: number;
  price: number | null;
  startAtMs: number;
  endAtMs: number;
};

type AppointmentDoc = {
  dayKey?: string;
  shopId?: string | null;
  startAtMs: number;
  endAtMs: number;
  status: AppointmentStatus;
};

type UserAppointmentDoc = AppointmentDoc & {
  whenMs?: number;
};

export class AvailabilityError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'AvailabilityError';
    this.code = code;
  }
}

// As funções abaixo (overlaps/isWithinBusinessHours/generateSlots/
// filterAvailableSlots) são a lógica pura de disponibilidade e capacidade;
// exportadas para teste unitário direto (sem tocar no Firestore).
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isWithinBusinessHours(slot: Slot, settings: ShopSettings): boolean {
  const slotStartHour = new Date(slot.startAtMs).getHours();
  const slotEndHour = new Date(slot.endAtMs).getHours();
  const slotEndMinutes = new Date(slot.endAtMs).getMinutes();

  const slotStartMinutes = slotStartHour * 60 + new Date(slot.startAtMs).getMinutes();
  const slotEndMinutesTotal = slotEndHour * 60 + slotEndMinutes;

  const openMinutes = settings.openHour * 60;
  const closeMinutes = settings.closeHour * 60;

  return slotStartMinutes >= openMinutes && slotEndMinutesTotal <= closeMinutes;
}

function isNotInPast(slot: Slot): boolean {
  return slot.startAtMs > Date.now();
}

function hasValidDuration(slot: Slot, requiredDuration: number): boolean {
  const actualDuration = (slot.endAtMs - slot.startAtMs) / (60 * 1000);
  return Math.abs(actualDuration - requiredDuration) < 1;
}

function isActiveAppointmentStatus(status?: AppointmentStatus): boolean {
  return (ACTIVE_APPOINTMENT_SET as readonly AppointmentStatus[]).includes(
    status as AppointmentStatus,
  );
}

async function getCustomerAppointmentsForDay(
  customerUid: string,
  dayKey: string,
  dayStart: number,
  dayEnd: number,
): Promise<UserAppointmentDoc[]> {
  const db = getFirestore();
  const appointments = new Map<string, UserAppointmentDoc>();

  const qByDayKey = query(
    collection(db, 'users', customerUid, 'appointments'),
    where('dayKey', '==', dayKey),
  );
  const snapByDayKey = await getDocs(qByDayKey);

  snapByDayKey.docs.forEach((d: QDoc) => {
    appointments.set(d.id, d.data() as UserAppointmentDoc);
  });

  const qByRange = query(
    collection(db, 'users', customerUid, 'appointments'),
    where('whenMs', '>=', dayStart),
    where('whenMs', '<=', dayEnd),
  );
  const snapByRange = await getDocs(qByRange);

  snapByRange.docs.forEach((d: QDoc) => {
    appointments.set(d.id, d.data() as UserAppointmentDoc);
  });

  return Array.from(appointments.values());
}

async function assertCustomerCanBookShopOnDay(
  customerUid: string,
  shopId: string,
  dayKey: string,
  dayStart: number,
  dayEnd: number,
) {
  const customerAppointments = await getCustomerAppointmentsForDay(
    customerUid,
    dayKey,
    dayStart,
    dayEnd,
  );

  const hasDifferentShopAppointment = customerAppointments.some(
    appt => isActiveAppointmentStatus(appt.status) && !!appt.shopId && appt.shopId !== shopId,
  );

  if (hasDifferentShopAppointment) {
    throw new AvailabilityError(
      'Você já possui agendamento em outra estética nesta data.',
      'CUSTOMER_DAILY_SHOP_CONFLICT',
    );
  }
}

/**
 * Slot ocupado (sem PII): espelho só com os horários de um agendamento
 * 'scheduled', em shops/{shopId}/slots. É o que a disponibilidade lê — assim o
 * cliente nunca precisa ler os agendamentos (com nome) de outros clientes.
 */
type SlotDoc = { startAtMs: number; endAtMs: number };

async function getBusySlotsForDay(shopId: string, dayKey: string): Promise<SlotDoc[]> {
  const db = getFirestore();
  const snap = await getDocs(
    query(collection(db, 'shops', shopId, 'slots'), where('dayKey', '==', dayKey)),
  );
  return snap.docs.map((d: QDoc) => d.data() as SlotDoc);
}

export function generateSlots(day: Date, settings: ShopSettings, durationMin: number): Slot[] {
  const open = new Date(day);
  open.setHours(settings.openHour, 0, 0, 0);

  const close = new Date(day);
  close.setHours(settings.closeHour, 0, 0, 0);

  // Cada serviço usa a própria duração como intervalo entre os horários:
  // lavagem (30min) → 8:00, 8:30, 9:00…; polimento (90min) → 8:00, 9:30, 11:00…
  const durationMs = durationMin * 60 * 1000;

  const slots: Slot[] = [];
  for (let t = open.getTime(); t + durationMs <= close.getTime(); t += durationMs) {
    slots.push({
      startAtMs: t,
      endAtMs: t + durationMs,
      durationMin,
    });
  }

  return slots;
}

export function filterAvailableSlots(
  slots: Slot[],
  busy: readonly { startAtMs: number; endAtMs: number }[],
  capacity: number,
): Slot[] {
  return slots.filter(slot => {
    let concurrent = 0;
    for (const b of busy) {
      if (overlaps(b.startAtMs, b.endAtMs, slot.startAtMs, slot.endAtMs)) {
        concurrent += 1;
        if (concurrent >= capacity) return false;
      }
    }
    return true;
  });
}

export async function getAvailableSlotsForDay(
  day: Date,
  durationMin: number,
  shopId: string,
): Promise<Slot[]> {
  const settings = await getShopSettings(shopId);

  // Dia não atendido pela estética → sem horários disponíveis.
  const WEEKDAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const;
  if (!settings.workingDays.includes(WEEKDAY_KEYS[day.getDay()])) {
    return [];
  }

  const dayKey = dateUtils.toDayKey(day);
  const busy = await getBusySlotsForDay(shopId, dayKey);

  const allSlots = generateSlots(day, settings, durationMin);

  const validSlots = allSlots.filter(slot => {
    if (!isNotInPast(slot)) return false;
    if (!isWithinBusinessHours(slot, settings)) return false;
    if (!hasValidDuration(slot, durationMin)) return false;
    return true;
  });

  return filterAvailableSlots(validSlots, busy, settings.parallelCapacity);
}

async function getCustomerName(customerUid: string): Promise<string> {
  const db = getFirestore();
  const userSnap = await getDoc(doc(db, 'users', customerUid));
  const userData = (userSnap.data() ?? {}) as {
    firstName?: string;
    lastName?: string;
  };

  const firstName = userData.firstName || '';
  const lastName = userData.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || 'Cliente';
}

export async function createAppointmentWithCapacityCheck(input: AppointmentCreateInput) {
  const db = getFirestore();
  const { shopId } = input;
  const settings = await getShopSettings(shopId);
  const customerName = await getCustomerName(input.customerUid);
  const dayKey = dateUtils.toDayKey(input.startAtMs);
  const dayStart = dateUtils.startOfDay(new Date(input.startAtMs));
  const dayEnd = dateUtils.endOfDay(new Date(input.startAtMs));

  const slot: Slot = {
    startAtMs: input.startAtMs,
    endAtMs: input.endAtMs,
    durationMin: input.durationMin,
  };

  if (!isNotInPast(slot)) {
    throw new AvailabilityError('Não é possível agendar para horários passados', 'PAST_DATE');
  }

  if (!isWithinBusinessHours(slot, settings)) {
    throw new AvailabilityError('Horário fora do expediente', 'OUTSIDE_BUSINESS_HOURS');
  }

  await assertCustomerCanBookShopOnDay(input.customerUid, shopId, dayKey, dayStart, dayEnd);

  return runTransaction(db, async tx => {
    // Conta a concorrência pelos slots (sem PII), não pelos agendamentos.
    const qy = query(collection(db, 'shops', shopId, 'slots'), where('dayKey', '==', dayKey));

    const snap = await getDocs(qy);

    let concurrent = 0;
    snap.docs.forEach((d: QDoc) => {
      const s = d.data() as SlotDoc;
      if (overlaps(s.startAtMs, s.endAtMs, input.startAtMs, input.endAtMs)) {
        concurrent += 1;
      }
    });

    if (concurrent >= settings.parallelCapacity) {
      throw new AvailabilityError('Horário ocupado', 'SLOT_FULL');
    }

    const apptRef = doc(collection(db, 'shops', shopId, 'appointments'));
    tx.set(apptRef, {
      dayKey,
      shopId,
      customerUid: input.customerUid,
      customerName,
      vehicleType: input.vehicleType,
      carCategory: input.carCategory,
      serviceLabel: input.serviceLabel,
      durationMin: input.durationMin,
      price: input.price,
      startAtMs: input.startAtMs,
      endAtMs: input.endAtMs,
      status: 'scheduled',
      createdAt: serverTimestamp(),
    });

    // Slot público espelho (só horários, sem PII) — usado pela disponibilidade.
    // Os campos batem EXATAMENTE com o hasOnly das firestore.rules.
    const slotRef = doc(db, 'shops', shopId, 'slots', apptRef.id);
    tx.set(slotRef, {
      startAtMs: input.startAtMs,
      endAtMs: input.endAtMs,
      dayKey,
      shopId,
    });

    const userRef = doc(db, 'users', input.customerUid, 'appointments', apptRef.id);
    tx.set(userRef, {
      dayKey,
      shopId,
      appointmentId: apptRef.id,
      customerName,
      vehicleType: input.vehicleType,
      carCategory: input.carCategory,
      serviceLabel: input.serviceLabel,
      durationMin: input.durationMin,
      price: input.price,
      whenMs: input.startAtMs,
      endAtMs: input.endAtMs,
      status: 'scheduled',
      createdAt: serverTimestamp(),
    });

    return { id: apptRef.id };
  });
}

export async function checkSlotAvailability(
  startAtMs: number,
  durationMin: number,
  shopId: string,
): Promise<{ available: boolean; reason?: string }> {
  const settings = await getShopSettings(shopId);
  const dayKey = dateUtils.toDayKey(startAtMs);
  const endAtMs = startAtMs + durationMin * 60 * 1000;

  const slot: Slot = { startAtMs, endAtMs, durationMin };

  if (!isNotInPast(slot)) {
    return { available: false, reason: 'Horário no passado' };
  }

  if (!isWithinBusinessHours(slot, settings)) {
    return { available: false, reason: 'Fora do horário comercial' };
  }

  const db = getFirestore();
  const qy = query(collection(db, 'shops', shopId, 'slots'), where('dayKey', '==', dayKey));

  const snap = await getDocs(qy);
  let concurrent = 0;

  snap.docs.forEach((d: QDoc) => {
    const s = d.data() as SlotDoc;
    if (overlaps(s.startAtMs, s.endAtMs, startAtMs, endAtMs)) {
      concurrent += 1;
    }
  });

  if (concurrent >= settings.parallelCapacity) {
    return { available: false, reason: 'Capacidade esgotada' };
  }

  return { available: true };
}
