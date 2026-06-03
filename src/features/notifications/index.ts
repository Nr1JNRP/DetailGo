export { default as NotificationsScreen } from './screens/NotificationsScreen';
export { default as CustomerNotificationsScreen } from './screens/CustomerNotificationsScreen';
export { useShopNotifications } from './hooks/useShopNotifications';
export { useUserNotifications } from './hooks/useUserNotifications';
export { useRegisterPushToken } from './hooks/useRegisterPushToken';
export { useForegroundNotifications } from './hooks/useForegroundNotifications';
export {
  watchShopNotifications,
  watchUserNotifications,
  markAllNotificationsRead,
  markAllUserNotificationsRead,
} from './services/notifications.service';
export type { AppNotification, AppNotificationType } from './domain/notification.types';
