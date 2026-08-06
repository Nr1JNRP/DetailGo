import { colors, type AppColors } from '@shared/theme';

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

/**
 * Config de exibição do status (label + cor). Se receber a paleta do tema (`D`),
 * devolve cores theme-aware — em especial `in_progress` usa o neon `D.primary`,
 * padronizado com os cards. Sem a paleta, cai nas cores estáticas (fallback
 * usado em testes e contextos sem tema).
 */
export const getAppointmentStatusConfig = (
  status: 'scheduled' | 'in_progress' | 'done' | 'no_show' | 'cancelled',
  D?: AppColors,
): StatusConfig => {
  switch (status) {
    case 'done':
      return { label: 'Concluído', color: D ? D.status.success : colors.status.success };
    case 'in_progress':
      return { label: 'Em andamento', color: D ? D.primary : colors.primary.main };
    case 'no_show':
      return { label: 'Não realizado', color: D ? D.status.error : colors.status.error };
    case 'cancelled':
      return { label: 'Cancelado', color: D ? D.ink3 : colors.status.disabled };
    default: // scheduled
      return { label: 'Agendado', color: D ? D.ink3 : colors.text.disabled };
  }
};

export function filterActiveAppointments<T extends { status: string }>(appointments: T[]): T[] {
  return appointments.filter(item => item.status === 'scheduled' || item.status === 'in_progress');
}
