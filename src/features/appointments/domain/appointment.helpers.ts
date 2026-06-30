import { colors } from '@shared/theme';

import type { AppointmentStatus } from './appointment.types';
import { NO_SHOW_GRACE_MS } from './appointment.constants';

export type StatusConfig = {
  label: string;
  color: string;
};

/**
 * Um agendamento está "vencido" quando ainda consta como `scheduled` mas já
 * passou do horário marcado + a tolerância de não comparecimento. Nesse caso
 * não é mais um cancelamento do cliente — o desfecho (done/no_show) é decisão
 * do estabelecimento. Usado para esconder o botão Cancelar e tirar o card de
 * "Próximos serviços".
 */
export function isExpiredScheduled(
  status: AppointmentStatus,
  startAtMs: number,
  now: number = Date.now(),
): boolean {
  return status === 'scheduled' && now > startAtMs + NO_SHOW_GRACE_MS;
}

export const getAppointmentStatusConfig = (
  status: 'scheduled' | 'in_progress' | 'done' | 'no_show' | 'cancelled',
): StatusConfig => {
  switch (status) {
    case 'done':
      return { label: 'Concluído', color: colors.status.success };
    case 'in_progress':
      return { label: 'Em andamento', color: colors.status.warning };
    case 'no_show':
      return { label: 'Não realizado', color: colors.status.error };
    case 'cancelled':
      return { label: 'Cancelado', color: colors.status.disabled };
    default: // scheduled
      return { label: 'Agendado', color: colors.text.disabled };
  }
};

export function filterActiveAppointments<T extends { status: string }>(appointments: T[]): T[] {
  return appointments.filter(item => item.status === 'scheduled' || item.status === 'in_progress');
}
