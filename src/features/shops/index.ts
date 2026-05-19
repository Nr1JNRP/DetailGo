export { ShopProvider, useShop } from './context/ShopContext';
export type { ShopDoc, UserRole, SubscriptionStatus } from './context/ShopContext';
export { useShopServices } from './hooks/useShopServices';
export { updateShopName } from './services/shop.service';
export { discoverNearbyShops } from './services/discoverShops.service';
export type { NearbyShop } from './services/discoverShops.service';
export type { ShopLocation } from './domain/shopLocation.types';
export {
  DEFAULT_SHOP_SERVICES,
  deleteShopService,
  ensureShopServices,
  updateShopService,
} from './services/shopServices.service';
export { getShopServiceIcon } from './utils/shopServiceIcons';
export type { ShopService, ShopServiceIconKey } from './domain/shopService.types';
