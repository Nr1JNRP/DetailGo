import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';

export type WeekDay = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

export const ALL_WEEK_DAYS: WeekDay[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

export const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  seg: 'Seg',
  ter: 'Ter',
  qua: 'Qua',
  qui: 'Qui',
  sex: 'Sex',
  sab: 'Sáb',
  dom: 'Dom',
};

export type ShopSettings = {
  openHour: number;
  closeHour: number;
  /** Quantos atendimentos simultâneos a estética suporta (carros ao mesmo tempo) */
  parallelCapacity: number;
  /** Dias da semana em que a estética atende */
  workingDays: WeekDay[];
};

const DEFAULT_SETTINGS: ShopSettings = {
  openHour: 8,
  closeHour: 18,
  parallelCapacity: 2,
  workingDays: ['seg', 'ter', 'qua', 'qui', 'sex'],
};

export class ShopSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShopSettingsError';
  }
}

function validateHour(hour?: number): number | null {
  return hour != null && hour >= 0 && hour <= 23 ? hour : null;
}

function validateCapacity(capacity?: number): number | null {
  return capacity && capacity >= 1 && capacity <= 10 ? capacity : null;
}

function validateWorkingDays(days?: unknown): WeekDay[] {
  if (!Array.isArray(days) || days.length === 0) return DEFAULT_SETTINGS.workingDays;
  return days.filter((d): d is WeekDay => ALL_WEEK_DAYS.includes(d as WeekDay));
}

function validateAndMergeSettings(data: Partial<ShopSettings>): ShopSettings {
  return {
    openHour: validateHour(data?.openHour) ?? DEFAULT_SETTINGS.openHour,
    closeHour: validateHour(data?.closeHour) ?? DEFAULT_SETTINGS.closeHour,
    parallelCapacity: validateCapacity(data?.parallelCapacity) ?? DEFAULT_SETTINGS.parallelCapacity,
    workingDays: validateWorkingDays(data?.workingDays),
  };
}

function hasSettingsChanged(old: Partial<ShopSettings>, newSettings: ShopSettings): boolean {
  return (Object.keys(newSettings) as Array<keyof ShopSettings>).some(key => {
    if (key === 'workingDays') {
      const a = (old.workingDays ?? []).slice().sort().join(',');
      const b = newSettings.workingDays.slice().sort().join(',');
      return a !== b;
    }
    return old[key] !== newSettings[key];
  });
}

function settingsRef(shopId: string) {
  return doc(getFirestore(), 'shops', shopId, 'settings', 'config');
}

export async function ensureShopSettings(shopId: string): Promise<{
  created: boolean;
  settings: ShopSettings;
}> {
  const ref = settingsRef(shopId);

  try {
    const snap = await getDoc(ref);

    if (!snap.exists) {
      await setDoc(ref, {
        ...DEFAULT_SETTINGS,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { created: true, settings: DEFAULT_SETTINGS };
    }

    const data = snap.data() as Partial<ShopSettings>;
    const merged = validateAndMergeSettings(data);

    if (hasSettingsChanged(data, merged)) {
      await setDoc(ref, { ...merged, updatedAt: serverTimestamp() }, { merge: true });
    }

    return { created: false, settings: merged };
  } catch {
    throw new ShopSettingsError('Falha ao carregar configurações da loja');
  }
}

export async function getShopSettings(shopId: string): Promise<ShopSettings> {
  const { settings } = await ensureShopSettings(shopId);
  return settings;
}

export async function updateShopSettings(
  shopId: string,
  updates: Partial<ShopSettings>,
): Promise<ShopSettings> {
  const ref = settingsRef(shopId);
  const current = await getShopSettings(shopId);
  const merged = validateAndMergeSettings({ ...current, ...updates });

  await setDoc(ref, { ...merged, updatedAt: serverTimestamp() }, { merge: true });

  return merged;
}
