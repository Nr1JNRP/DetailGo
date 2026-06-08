import { colors } from '@shared/theme';

export type StatusConfig = {
  label: string;
  color: string;
};

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
