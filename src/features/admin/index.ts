export { default as AdminDashboardScreen } from './screens/AdminDashboardScreen';
export { default as AdminManageScreen } from './screens/AdminManageScreen';
export { default as AdminHistoryScreen } from './screens/AdminHistoryScreen';
export { updateAppointmentStatus } from './services/adminAppointments.service';
export { normalizeAdminAppointmentFromGlobal } from './data/adminAppointment.normalizers';
export type { AdminAppointment } from './domain/adminAppointment.types';
