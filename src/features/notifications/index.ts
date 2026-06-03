export { default as NotificationsScreen } from './screens/NotificationsScreen';
export { useShopNotifications } from './hooks/useShopNotifications';
export { useRegisterPushToken } from './hooks/useRegisterPushToken';
export { useForegroundNotifications } from './hooks/useForegroundNotifications';
export {
  watchShopNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from './services/notifications.service';
export type { ShopNotification, ShopNotificationType } from './data/notification.types';
