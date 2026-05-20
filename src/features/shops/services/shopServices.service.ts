import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

import type {
  ShopService,
  ShopServiceIconKey,
  ShopServiceInput,
} from '../domain/shopService.types';
import { CAR_CATEGORIES, VEHICLE_TYPES } from '@features/appointments/domain/appointment.constants';
import type { CarCategory, VehicleType } from '@features/appointments/domain/appointment.types';

type QDoc = FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>;

const DEFAULT_SERVICE_VEHICLE_TYPES: VehicleType[] = [...VEHICLE_TYPES];
const DEFAULT_SERVICE_CAR_CATEGORIES: CarCategory[] = [...CAR_CATEGORIES];

export const DEFAULT_SHOP_SERVICES: ShopServiceInput[] = [
  {
    name: 'Lavagem',
    title: 'Lavagem',
    description: 'Limpeza externa essencial',
    includes: ['Lavagem externa', 'Limpeza de vidros', 'Aspiração rápida', 'Acabamento nos pneus'],
    note: 'Ideal para manutenção semanal.',
    recommendedFor: ['Uso diário', 'Manutenção'],
    durationMin: 30,
    price: 80,
    vehicleTypes: DEFAULT_SERVICE_VEHICLE_TYPES,
    carCategories: DEFAULT_SERVICE_CAR_CATEGORIES,
    iconKey: 'wash',
    active: true,
    sortOrder: 0,
  },
  {
    name: 'Polimento',
    title: 'Polimento técnico',
    description: 'Recuperação de brilho da pintura',
    includes: ['Correção de swirls', 'Remoção de riscos leves', 'Proteção da pintura'],
    note: 'Recomendado a cada 6 meses.',
    recommendedFor: ['Carros +1 ano', 'Pré-venda'],
    durationMin: 120,
    price: 220,
    vehicleTypes: DEFAULT_SERVICE_VEHICLE_TYPES,
    carCategories: DEFAULT_SERVICE_CAR_CATEGORIES,
    iconKey: 'polish',
    active: true,
    sortOrder: 1,
  },
  {
    name: 'Cera',
    title: 'Cera',
    description: 'Proteção e acabamento da pintura',
    includes: ['Aplicação de cera', 'Brilho da pintura', 'Proteção leve'],
    note: 'Ajuda a proteger a pintura no uso diário.',
    recommendedFor: ['Proteção', 'Brilho'],
    durationMin: 60,
    price: 120,
    vehicleTypes: DEFAULT_SERVICE_VEHICLE_TYPES,
    carCategories: DEFAULT_SERVICE_CAR_CATEGORIES,
    iconKey: 'wax',
    active: true,
    sortOrder: 2,
  },
  {
    name: 'Express',
    title: 'Express',
    description: 'Serviço rápido para o dia a dia',
    includes: ['Limpeza rápida', 'Acabamento visual', 'Entrega ágil'],
    note: 'Pensado para quem precisa resolver rápido.',
    recommendedFor: ['Rotina', 'Pouco tempo'],
    durationMin: 30,
    price: 50,
    vehicleTypes: DEFAULT_SERVICE_VEHICLE_TYPES,
    carCategories: DEFAULT_SERVICE_CAR_CATEGORIES,
    iconKey: 'express',
    active: true,
    sortOrder: 3,
  },
];

function normalizeIconKey(value: unknown): ShopServiceIconKey {
  const validKeys: ShopServiceIconKey[] = ['wash', 'polish', 'wax', 'express', 'engine', 'default'];
  return validKeys.includes(value as ShopServiceIconKey)
    ? (value as ShopServiceIconKey)
    : 'default';
}

function normalizeVehicleTypes(value: unknown): VehicleType[] {
  if (!Array.isArray(value)) return DEFAULT_SERVICE_VEHICLE_TYPES;

  const unique = Array.from(new Set(value)).filter(item =>
    VEHICLE_TYPES.includes(item as VehicleType),
  ) as VehicleType[];

  return unique.length > 0 ? unique : DEFAULT_SERVICE_VEHICLE_TYPES;
}

function normalizeCarCategories(value: unknown, vehicleTypes: VehicleType[]): CarCategory[] {
  if (!vehicleTypes.includes('Carro')) return [];
  if (!Array.isArray(value)) return DEFAULT_SERVICE_CAR_CATEGORIES;

  const unique = Array.from(new Set(value)).filter(item =>
    CAR_CATEGORIES.includes(item as CarCategory),
  ) as CarCategory[];

  return unique.length > 0 ? unique : DEFAULT_SERVICE_CAR_CATEGORIES;
}

export function serviceSupportsVehicle(
  service: Pick<ShopService, 'vehicleTypes' | 'carCategories'>,
  vehicleType: VehicleType,
  carCategory: CarCategory | null,
): boolean {
  if (!service.vehicleTypes.includes(vehicleType)) return false;
  if (vehicleType === 'Moto') return true;
  return !!carCategory && service.carCategories.includes(carCategory);
}

export function getServiceVehicleSummary(service: ShopService): string {
  const parts: string[] = [];
  if (service.vehicleTypes.includes('Moto')) parts.push('Moto');
  if (service.vehicleTypes.includes('Carro')) {
    parts.push(
      service.carCategories.length === CAR_CATEGORIES.length
        ? 'Todos os carros'
        : service.carCategories.join(', '),
    );
  }
  return parts.join(' · ') || 'Nenhum veículo';
}

export function normalizeShopService(d: QDoc): ShopService | null {
  const v = d.data() as Partial<ShopService>;
  const name = typeof v.name === 'string' ? v.name.trim() : '';
  if (!name) return null;

  const vehicleTypes = normalizeVehicleTypes(v.vehicleTypes);

  return {
    id: d.id,
    name,
    title: typeof v.title === 'string' ? v.title : name,
    description: typeof v.description === 'string' ? v.description : null,
    includes: Array.isArray(v.includes) ? v.includes.filter(item => typeof item === 'string') : [],
    note: typeof v.note === 'string' ? v.note : null,
    recommendedFor: Array.isArray(v.recommendedFor)
      ? v.recommendedFor.filter(item => typeof item === 'string')
      : [],
    durationMin: typeof v.durationMin === 'number' && v.durationMin > 0 ? v.durationMin : 30,
    price: typeof v.price === 'number' && v.price >= 0 ? v.price : 0,
    vehicleTypes,
    carCategories: normalizeCarCategories(v.carCategories, vehicleTypes),
    iconKey: normalizeIconKey(v.iconKey),
    active: typeof v.active === 'boolean' ? v.active : true,
    sortOrder: typeof v.sortOrder === 'number' ? v.sortOrder : 999,
  };
}

export function shopServicesRef(shopId: string) {
  return collection(getFirestore(), 'shops', shopId, 'services');
}

export function shopServicesQuery(shopId: string) {
  return query(shopServicesRef(shopId), orderBy('sortOrder', 'asc'));
}

export async function ensureShopServices(shopId: string): Promise<ShopService[]> {
  const snap = await getDocs(shopServicesQuery(shopId));
  const current = snap.docs.map(normalizeShopService).filter(Boolean) as ShopService[];

  if (current.length > 0) return current;

  const db = getFirestore();
  const batch = writeBatch(db);

  DEFAULT_SHOP_SERVICES.forEach(service => {
    const id = service.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const ref = doc(db, 'shops', shopId, 'services', id);
    batch.set(ref, {
      ...service,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();

  return DEFAULT_SHOP_SERVICES.map((service, index) => ({
    id: service.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''),
    ...service,
    sortOrder: service.sortOrder ?? index,
  }));
}

export async function updateShopService(
  shopId: string,
  serviceId: string,
  updates: Partial<
    Pick<
      ShopService,
      | 'active'
      | 'description'
      | 'durationMin'
      | 'includes'
      | 'name'
      | 'note'
      | 'price'
      | 'recommendedFor'
      | 'title'
      | 'vehicleTypes'
      | 'carCategories'
    >
  >,
): Promise<void> {
  await updateDoc(doc(getFirestore(), 'shops', shopId, 'services', serviceId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteShopService(shopId: string, serviceId: string): Promise<void> {
  await deleteDoc(doc(getFirestore(), 'shops', shopId, 'services', serviceId));
}

export async function createShopService(
  shopId: string,
  serviceId: string,
  service: ShopServiceInput,
) {
  await setDoc(doc(getFirestore(), 'shops', shopId, 'services', serviceId), {
    ...service,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
