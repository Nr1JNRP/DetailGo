import type { CarCategory, VehicleType } from '@features/appointments/domain/appointment.types';

export type ShopServiceIconKey = 'wash' | 'polish' | 'wax' | 'express' | 'engine' | 'default';

export type ShopService = {
  id: string;
  name: string;
  title?: string | null;
  description?: string | null;
  includes?: string[];
  note?: string | null;
  recommendedFor?: string[];
  durationMin: number;
  price: number;
  vehicleTypes: VehicleType[];
  carCategories: CarCategory[];
  iconKey: ShopServiceIconKey;
  active: boolean;
  sortOrder: number;
};

export type ShopServiceInput = Omit<ShopService, 'id'>;
