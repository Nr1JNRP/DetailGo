import { NO_SHOW_GRACE_MS } from '../domain/appointment.constants';
import { AppointmentStatus } from '../domain/appointment.types';

export function isExpiredAppointment(startAtMs: number, status: AppointmentStatus): boolean {
  if (status !== 'scheduled') return false;
  return Date.now() >= startAtMs + NO_SHOW_GRACE_MS;
}

export function resolveDisplayStatus(
  startAtMs: number,
  status: AppointmentStatus,
): AppointmentStatus {
  if (isExpiredAppointment(startAtMs, status)) {
    return 'no_show';
  }
  return status;
}
