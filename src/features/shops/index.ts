export { ShopProvider, useShop } from './context/ShopContext';
export type { ShopDoc, UserRole, SubscriptionStatus } from './context/ShopContext';
export { computeSubscription, GRACE_DAYS } from './state/shop.store';
export type { SubscriptionState } from './state/shop.store';
export { useShopServices } from './hooks/useShopServices';
export { updateShopName } from './services/shop.service';
export { discoverNearbyShops } from './services/discoverShops.service';
export type { NearbyShop } from './services/discoverShops.service';
export type { ShopLocation } from './domain/shopLocation.types';
export {
  createShopService,
  DEFAULT_SHOP_SERVICES,
  deleteShopService,
  ensureShopServices,
  getServiceVehicleSummary,
  serviceSupportsVehicle,
  updateShopService,
} from './services/shopServices.service';
export { getShopServiceIcon } from './utils/shopServiceIcons';
export type { ShopService, ShopServiceIconKey, ShopServiceInput } from './domain/shopService.types';
export { default as ShopProfileScreen } from './screens/ShopProfileScreen';
