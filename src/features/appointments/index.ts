// Screens
export { default as AppointmentScreen } from './screens/AppointmentScreen';
export { default as HistoryScreen } from './screens/HistoryScreen';
export { default as MyAppointmentsScreen } from './screens/MyAppointmentsScreen';

// Hooks
export { useUserAppointments } from './hooks/useUserAppointments';
export { useDashboardAppointments } from './hooks/useDashboardAppointments';

// Domain
export * from './domain/appointment.types';
export {
  ACTIVE_APPOINTMENT_SET,
  APPOINTMENT,
  CAR_CATEGORIES,
  CAR_CATEGORY_BASE_PRICE,
  HISTORY_APPOINTMENT_SET,
  MOTO_BASE_PRICE,
  NO_SHOW_GRACE_MIN,
  NO_SHOW_GRACE_MS,
  STATUS,
  VEHICLE_TYPES,
} from './domain/appointment.constants';
export { getAppointmentStatusConfig } from './domain/appointment.helpers';

// Services
export {
  createAppointmentWithCapacityCheck,
  getAvailableSlotsForDay,
} from './services/availability.service';
export type { Slot } from './services/availability.service';
export {
  clearShopFavoriteIfNoActive,
  markExpiredScheduledAppointmentsAsNoShow,
} from './services/appointment.service';

// Components
export { default as AppointmentCard } from './components/AppointmentCard';
