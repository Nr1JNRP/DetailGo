import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Store,
  Clock,
  Check,
  ChevronUp,
  ChevronDown,
  Pencil,
  Plus,
  Trash2,
  LogOut,
} from 'lucide-react-native';

import { getAuth, signOut } from '@react-native-firebase/auth';
import { spacing, radii, useAppTheme, type AppColors, typography as T } from '@shared/theme';
import { formatUtils } from '@shared/utils/format.utils';
import {
  useShop,
  useShopServices,
  createShopService,
  updateShopName,
  deleteShopService,
  getServiceVehicleSummary,
  getShopServiceIcon,
  updateShopService,
} from '@features/shops';
import type { ShopService, ShopServiceInput } from '@features/shops';
import { CAR_CATEGORIES, VEHICLE_TYPES } from '@features/appointments/domain/appointment.constants';
import type { CarCategory, VehicleType } from '@features/appointments/domain/appointment.types';
import {
  getShopSettings,
  updateShopSettings,
  type ShopSettings,
  ALL_WEEK_DAYS,
  WEEK_DAY_LABELS,
} from '@features/settings';
import SelectModal from '@shared/components/SelectModal';
import ConfirmModal from '@shared/components/ConfirmModal';
import { useFeedback } from '@shared/components/FeedbackProvider';

const NEW_SERVICE_DRAFT = '__new_service__';

// Opções de duração (valor em minutos, rótulo amigável em h/min).
const DURATION_OPTIONS: { label: string; value: string }[] = [
  { label: '30 min', value: '30' },
  { label: '45 min', value: '45' },
  { label: '1h', value: '60' },
  { label: '1h 30min', value: '90' },
  { label: '2h', value: '120' },
  { label: '2h 30min', value: '150' },
  { label: '3h', value: '180' },
];

function formatDurationLabel(min: string): string {
  const found = DURATION_OPTIONS.find(o => o.value === min);
  if (found) return found.label;
  const n = Number(min);
  if (!n) return 'Selecionar';
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h ? (m ? `${h}h ${m}min` : `${h}h`) : `${m} min`;
}

type ServiceDraft = {
  name: string;
  description: string;
  includes: string;
  note: string;
  durationMin: string;
  price: string;
  recommendedFor: string;
  vehicleTypes: VehicleType[];
  carCategories: CarCategory[];
};

function toServiceDraft(service: ShopService): ServiceDraft {
  return {
    name: service.name,
    description: service.description ?? '',
    includes: (service.includes ?? []).join('\n'),
    note: service.note ?? '',
    durationMin: String(service.durationMin),
    price: String(service.price),
    recommendedFor: (service.recommendedFor ?? []).join('\n'),
    vehicleTypes: service.vehicleTypes,
    carCategories: service.carCategories,
  };
}

function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);
}

function createEmptyServiceDraft(): ServiceDraft {
  return {
    name: '',
    description: '',
    includes: '',
    note: '',
    durationMin: '30',
    price: '',
    recommendedFor: '',
    vehicleTypes: [...VEHICLE_TYPES],
    carCategories: [...CAR_CATEGORIES],
  };
}

function createServiceId(name: string, existingIds: string[]): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'servico';

  let candidate = base;
  let suffix = 2;
  while (existingIds.includes(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export default function AdminManageScreen() {
  const { colors: D, isLight } = useAppTheme();
  const { showError } = useFeedback();
  const styles = useMemo(() => createStyles(D), [D]);
  const navigation = useNavigation();
  const { shopId, shop } = useShop();
  const auth = getAuth();

  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const handleSignOut = () => {
    setConfirm({
      title: 'Sair da conta',
      message: 'Deseja realmente sair?',
      confirmLabel: 'Sair',
      destructive: true,
      onConfirm: async () => {
        try {
          await signOut(auth);
        } catch {
          showError('Falha ao sair da conta.');
        }
      },
    });
  };

  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSettings, setSavedSettings] = useState(false);

  const [shopName, setShopName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);

  const { loading: loadingServices, items: services } = useShopServices({
    shopId,
    ensureDefaults: false,
  });
  const [serviceDrafts, setServiceDrafts] = useState<Record<string, ServiceDraft>>({});
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null);
  const [savedServiceId, setSavedServiceId] = useState<string | null>(null);
  const [addingService, setAddingService] = useState(false);
  const [newServiceDraft, setNewServiceDraft] = useState<ServiceDraft>(() =>
    createEmptyServiceDraft(),
  );
  // serviceId (ou NEW_SERVICE_DRAFT) cujo seletor de duração está aberto.
  const [durationPickerFor, setDurationPickerFor] = useState<string | null>(null);

  useEffect(() => {
    if (shop?.name) setShopName(shop.name);
  }, [shop?.name]);

  useEffect(() => {
    if (!shopId) return;
    setLoadingSettings(true);
    getShopSettings(shopId)
      .then(s => setSettings(s))
      .catch(() => showError('Falha ao carregar configurações.'))
      .finally(() => setLoadingSettings(false));
  }, [shopId, showError]);

  useEffect(() => {
    setServiceDrafts(prev => {
      const next = { ...prev };
      services.forEach(service => {
        if (!next[service.id]) next[service.id] = toServiceDraft(service);
      });
      return next;
    });
  }, [services]);

  const handleSaveName = async () => {
    if (!shopId || !shopName.trim()) return;
    setSavingName(true);
    try {
      await updateShopName(shopId, shopName);
      setSavedName(true);
      setTimeout(() => setSavedName(false), 2000);
    } catch (e: any) {
      showError(e?.message ?? 'Falha ao salvar nome.');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!shopId || !settings) return;
    if (settings.openHour >= settings.closeHour) {
      showError('Horário de abertura deve ser anterior ao fechamento.', { title: 'Atenção' });
      return;
    }
    setSavingSettings(true);
    try {
      const updated = await updateShopSettings(shopId, settings);
      setSettings(updated);
      setSavedSettings(true);
      setTimeout(() => setSavedSettings(false), 2000);
    } catch {
      showError('Falha ao salvar configurações.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleService = async (serviceId: string, active: boolean) => {
    if (!shopId) return;
    try {
      await updateShopService(shopId, serviceId, { active });
    } catch {
      showError('Falha ao atualizar serviço.');
    }
  };

  const handleEditService = (service: ShopService) => {
    setServiceDrafts(prev => ({
      ...prev,
      [service.id]: toServiceDraft(service),
    }));
    setEditingServiceId(service.id);
  };

  const updateServiceDraft = (serviceId: string, field: keyof ServiceDraft, value: string) => {
    if (serviceId === NEW_SERVICE_DRAFT) {
      setNewServiceDraft(prev => ({ ...prev, [field]: value }));
      return;
    }

    setServiceDrafts(prev => ({
      ...prev,
      [serviceId]: {
        ...(prev[serviceId] ?? createEmptyServiceDraft()),
        [field]: value,
      },
    }));
  };

  const updateServiceDraftList = (
    serviceId: string,
    updater: (draft: ServiceDraft) => ServiceDraft,
  ) => {
    if (serviceId === NEW_SERVICE_DRAFT) {
      setNewServiceDraft(prev => updater(prev));
      return;
    }

    setServiceDrafts(prev => {
      const draft = prev[serviceId] ?? createEmptyServiceDraft();

      return {
        ...prev,
        [serviceId]: updater(draft),
      };
    });
  };

  const toggleVehicleType = (serviceId: string, vehicleType: VehicleType) => {
    updateServiceDraftList(serviceId, draft => {
      const hasVehicle = draft.vehicleTypes.includes(vehicleType);
      const vehicleTypes = hasVehicle
        ? draft.vehicleTypes.filter(item => item !== vehicleType)
        : [...draft.vehicleTypes, vehicleType];

      return {
        ...draft,
        vehicleTypes,
        carCategories: vehicleTypes.includes('Carro') ? draft.carCategories : [],
      };
    });
  };

  const toggleCarCategory = (serviceId: string, category: CarCategory) => {
    updateServiceDraftList(serviceId, draft => {
      const hasCategory = draft.carCategories.includes(category);
      return {
        ...draft,
        carCategories: hasCategory
          ? draft.carCategories.filter(item => item !== category)
          : [...draft.carCategories, category],
      };
    });
  };

  const buildServiceInput = (draft: ServiceDraft, sortOrder: number): ShopServiceInput | null => {
    const name = draft.name.trim();
    const description = draft.description.trim();
    const includes = parseLines(draft.includes);
    const note = draft.note.trim();
    const durationMin = Number(draft.durationMin.replace(',', '.'));
    const price = Number(draft.price.replace(',', '.'));
    const recommendedFor = parseLines(draft.recommendedFor);
    const vehicleTypes = draft.vehicleTypes;
    const carCategories = vehicleTypes.includes('Carro') ? draft.carCategories : [];

    if (!name) {
      showError('Informe o nome do serviço.', { title: 'Atenção' });
      return null;
    }

    if (!durationMin || durationMin < 5) {
      showError('Informe uma duração válida para o serviço.', { title: 'Atenção' });
      return null;
    }

    if (Number.isNaN(price) || price < 0) {
      showError('Informe um preço válido para o serviço.', { title: 'Atenção' });
      return null;
    }

    if (vehicleTypes.length === 0) {
      showError('Selecione pelo menos um tipo de veículo para o serviço.', { title: 'Atenção' });
      return null;
    }

    if (vehicleTypes.includes('Carro') && carCategories.length === 0) {
      showError('Selecione pelo menos uma categoria de carro para o serviço.', {
        title: 'Atenção',
      });
      return null;
    }

    return {
      name,
      title: name,
      description: description || null,
      includes,
      note: note || null,
      durationMin,
      price,
      recommendedFor,
      vehicleTypes,
      carCategories,
      iconKey: 'default',
      active: true,
      sortOrder,
    };
  };

  const handleCreateService = async () => {
    if (!shopId) return;
    const nextSortOrder =
      services.reduce((max, service) => Math.max(max, service.sortOrder), -1) + 1;
    const input = buildServiceInput(newServiceDraft, nextSortOrder);
    if (!input) return;

    const serviceId = createServiceId(
      input.name,
      services.map(service => service.id),
    );

    setSavingServiceId(NEW_SERVICE_DRAFT);
    try {
      await createShopService(shopId, serviceId, input);
      setNewServiceDraft(createEmptyServiceDraft());
      setAddingService(false);
      setSavedServiceId(serviceId);
      setTimeout(() => setSavedServiceId(null), 2000);
    } catch {
      showError('Falha ao criar serviço.');
    } finally {
      setSavingServiceId(null);
    }
  };

  const handleSaveService = async (service: ShopService) => {
    if (!shopId) return;
    const draft = serviceDrafts[service.id] ?? toServiceDraft(service);
    const input = buildServiceInput(draft, service.sortOrder);
    if (!input) return;

    setSavingServiceId(service.id);
    try {
      await updateShopService(shopId, service.id, {
        name: input.name,
        title: input.title,
        description: input.description,
        includes: input.includes,
        note: input.note,
        durationMin: input.durationMin,
        price: input.price,
        recommendedFor: input.recommendedFor,
        vehicleTypes: input.vehicleTypes,
        carCategories: input.carCategories,
      });
      setEditingServiceId(null);
      setSavedServiceId(service.id);
      setTimeout(() => setSavedServiceId(null), 2000);
    } catch {
      showError('Falha ao salvar serviço.');
    } finally {
      setSavingServiceId(null);
    }
  };

  const handleDeleteService = (service: ShopService) => {
    if (!shopId) return;

    setConfirm({
      title: 'Excluir serviço',
      message: `Deseja excluir "${service.name}"? Clientes não verão mais este serviço para novos agendamentos.`,
      confirmLabel: 'Excluir',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteShopService(shopId, service.id);
          setEditingServiceId(current => (current === service.id ? null : current));
        } catch {
          showError('Falha ao excluir serviço.');
        }
      },
    });
  };

  const stepHour = (field: 'openHour' | 'closeHour', dir: 1 | -1) => {
    if (!settings) return;
    const val = settings[field] + dir;
    if (val < 0 || val > 23) return;
    setSettings(prev => (prev ? { ...prev, [field]: val } : prev));
  };

  const renderHourStepper = (label: string, field: 'openHour' | 'closeHour') => (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() => stepHour(field, -1)}
          activeOpacity={0.7}
        >
          <ChevronDown size={18} color={D.primary} />
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{formatUtils.padZero(settings?.[field] ?? 0)}:00</Text>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() => stepHour(field, 1)}
          activeOpacity={0.7}
        >
          <ChevronUp size={18} color={D.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const stepCapacity = (dir: 1 | -1) => {
    if (!settings) return;
    const val = settings.parallelCapacity + dir;
    if (val < 1 || val > 10) return;
    setSettings(prev => (prev ? { ...prev, parallelCapacity: val } : prev));
  };

  const renderCapacityStepper = () => (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>Atendimentos simultâneos</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() => stepCapacity(-1)}
          activeOpacity={0.7}
        >
          <ChevronDown size={18} color={D.primary} />
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{settings?.parallelCapacity ?? 1}</Text>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() => stepCapacity(1)}
          activeOpacity={0.7}
        >
          <ChevronUp size={18} color={D.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderServiceForm = ({
    draft,
    serviceId,
    isSaving,
    isSaved = false,
    saveLabel,
    onCancel,
    onSave,
  }: {
    draft: ServiceDraft;
    serviceId: string;
    isSaving: boolean;
    isSaved?: boolean;
    saveLabel: string;
    onCancel: () => void;
    onSave: () => void;
  }) => (
    <View style={styles.serviceForm}>
      <Text style={styles.inputLabel}>Nome do serviço</Text>
      <TextInput
        style={styles.serviceInput}
        value={draft.name}
        onChangeText={value => updateServiceDraft(serviceId, 'name', value)}
        placeholder="Ex: Lavagem premium"
        placeholderTextColor={D.ink3}
        editable={!isSaving}
        maxLength={40}
      />

      <Text style={styles.inputLabel}>Descrição</Text>
      <TextInput
        style={[styles.serviceInput, styles.serviceTextarea]}
        value={draft.description}
        onChangeText={value => updateServiceDraft(serviceId, 'description', value)}
        placeholder="Descreva o que está incluso neste serviço"
        placeholderTextColor={D.ink3}
        editable={!isSaving}
        multiline
        maxLength={160}
      />

      <Text style={styles.inputLabel}>Inclui</Text>
      <TextInput
        style={[styles.serviceInput, styles.serviceTextarea]}
        value={draft.includes}
        onChangeText={value => updateServiceDraft(serviceId, 'includes', value)}
        placeholder={'Um item por linha\nEx: Lavagem externa\nAspiração rápida'}
        placeholderTextColor={D.ink3}
        editable={!isSaving}
        multiline
        maxLength={260}
      />

      <Text style={styles.inputLabel}>Recomendado para</Text>
      <TextInput
        style={[styles.serviceInput, styles.serviceTextareaSmall]}
        value={draft.recommendedFor}
        onChangeText={value => updateServiceDraft(serviceId, 'recommendedFor', value)}
        placeholder={'Um item por linha\nEx: Uso diário\nManutenção'}
        placeholderTextColor={D.ink3}
        editable={!isSaving}
        multiline
        maxLength={180}
      />

      <Text style={styles.inputLabel}>Tipos de veículo atendidos</Text>
      <View style={styles.chipGroup}>
        {VEHICLE_TYPES.map(type => {
          const selected = draft.vehicleTypes.includes(type);
          return (
            <TouchableOpacity
              key={type}
              style={[styles.optionChip, selected && styles.optionChipActive]}
              onPress={() => toggleVehicleType(serviceId, type)}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionChipText, selected && styles.optionChipTextActive]}>
                {type}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {draft.vehicleTypes.includes('Carro') && (
        <>
          <Text style={styles.inputLabel}>Categorias de carro atendidas</Text>
          <View style={styles.chipGroup}>
            {CAR_CATEGORIES.map(category => {
              const selected = draft.carCategories.includes(category);
              return (
                <TouchableOpacity
                  key={category}
                  style={[styles.optionChip, selected && styles.optionChipActive]}
                  onPress={() => toggleCarCategory(serviceId, category)}
                  disabled={isSaving}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.optionChipText, selected && styles.optionChipTextActive]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.inputLabel}>Observação</Text>
      <TextInput
        style={styles.serviceInput}
        value={draft.note}
        onChangeText={value => updateServiceDraft(serviceId, 'note', value)}
        placeholder="Ex: Ideal para manutenção semanal"
        placeholderTextColor={D.ink3}
        editable={!isSaving}
        maxLength={120}
      />

      <View style={styles.serviceInlineFields}>
        <View style={styles.inlineField}>
          <Text style={styles.inputLabel}>Duração</Text>
          <TouchableOpacity
            style={[styles.serviceInput, styles.durationSelect]}
            onPress={() => setDurationPickerFor(serviceId)}
            disabled={isSaving}
            activeOpacity={0.75}
          >
            <Text style={[styles.durationSelectText, !draft.durationMin && { color: D.ink3 }]}>
              {formatDurationLabel(draft.durationMin)}
            </Text>
            <ChevronDown size={16} color={D.ink3} />
          </TouchableOpacity>
        </View>
        <View style={styles.inlineField}>
          <Text style={styles.inputLabel}>Preço</Text>
          <TextInput
            style={[styles.serviceInput, styles.priceInput]}
            value={draft.price}
            onChangeText={value => updateServiceDraft(serviceId, 'price', value)}
            placeholder="80"
            placeholderTextColor={D.ink3}
            keyboardType="numeric"
            editable={!isSaving}
          />
        </View>
      </View>

      <View style={styles.serviceEditActions}>
        <TouchableOpacity
          style={styles.serviceCancelBtn}
          onPress={onCancel}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          <Text style={styles.serviceCancelText}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.serviceSaveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={onSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={D.onPrimary} />
          ) : isSaved ? (
            <>
              <Check size={16} color={D.onPrimary} />
              <Text style={styles.serviceSaveText}>Salvo!</Text>
            </>
          ) : (
            <Text style={styles.serviceSaveText}>{saveLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={D.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gerenciar Loja</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* ── Nome da loja ── */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.cardIconWrap, { backgroundColor: D.primaryLight }]}>
                <Store size={18} color={D.primary} />
              </View>
              <Text style={styles.cardTitle}>Nome da loja</Text>
            </View>

            <TextInput
              style={styles.nameInput}
              value={shopName}
              onChangeText={setShopName}
              placeholder="Ex: Auto Detailing São Paulo"
              placeholderTextColor={D.ink3}
              editable={!savingName}
              maxLength={60}
            />

            <TouchableOpacity
              style={[styles.saveBtn, (!shopName.trim() || savingName) && styles.saveBtnDisabled]}
              onPress={handleSaveName}
              disabled={!shopName.trim() || savingName}
              activeOpacity={0.8}
            >
              {savingName ? (
                <ActivityIndicator size="small" color={D.onPrimary} />
              ) : savedName ? (
                <>
                  <Check size={16} color={D.onPrimary} />
                  <Text style={styles.saveBtnText}>Salvo!</Text>
                </>
              ) : (
                <Text style={styles.saveBtnText}>Salvar nome</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Horários e dias de funcionamento ── */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.cardIconWrap, { backgroundColor: D.primaryLight }]}>
                <Clock size={18} color={D.primary} />
              </View>
              <Text style={styles.cardTitle}>Horário de funcionamento</Text>
            </View>

            {loadingSettings ? (
              <ActivityIndicator color={D.primary} style={{ marginVertical: spacing.lg }} />
            ) : settings ? (
              <>
                {renderHourStepper('Abertura', 'openHour')}
                <View style={styles.divider} />
                {renderHourStepper('Fechamento', 'closeHour')}

                <View style={styles.divider} />

                {renderCapacityStepper()}

                <View style={styles.divider} />

                {/* Dias da semana */}
                <View style={styles.stepperRow}>
                  <Text style={styles.stepperLabel}>Dias de atendimento</Text>
                </View>
                <View style={styles.weekDaysRow}>
                  {ALL_WEEK_DAYS.map(day => {
                    const active = settings.workingDays.includes(day);
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[styles.weekDayChip, active && styles.weekDayChipActive]}
                        onPress={() =>
                          setSettings(prev => {
                            if (!prev) return prev;
                            const days = active
                              ? prev.workingDays.filter(d => d !== day)
                              : [...prev.workingDays, day];
                            return { ...prev, workingDays: days };
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.weekDayText, active && styles.weekDayTextActive]}>
                          {WEEK_DAY_LABELS[day]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, savingSettings && styles.saveBtnDisabled]}
                  onPress={handleSaveSettings}
                  disabled={savingSettings}
                  activeOpacity={0.8}
                >
                  {savingSettings ? (
                    <ActivityIndicator size="small" color={D.onPrimary} />
                  ) : savedSettings ? (
                    <>
                      <Check size={16} color={D.onPrimary} />
                      <Text style={styles.saveBtnText}>Salvo!</Text>
                    </>
                  ) : (
                    <Text style={styles.saveBtnText}>Salvar configurações</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : null}
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.cardIconWrap, { backgroundColor: D.primaryLight }]}>
                <Store size={18} color={D.primary} />
              </View>
              <Text style={styles.cardTitle}>Serviços disponíveis</Text>
            </View>
            <Text style={styles.cardDesc}>
              Escolha quais serviços aparecem para os clientes vinculados à sua estética.
            </Text>

            {!addingService && (
              <TouchableOpacity
                style={styles.addServiceBtn}
                onPress={() => setAddingService(true)}
                activeOpacity={0.8}
              >
                <Plus size={16} color={D.primary} />
                <Text style={styles.addServiceText}>Adicionar serviço</Text>
              </TouchableOpacity>
            )}

            {loadingServices ? (
              <ActivityIndicator color={D.primary} style={{ marginVertical: spacing.lg }} />
            ) : (
              <View style={styles.servicesList}>
                {addingService && (
                  <View style={styles.serviceEditor}>
                    <View style={styles.serviceEditorHeader}>
                      <View style={styles.serviceRowLeft}>
                        <View style={styles.serviceIconWrap}>
                          <Plus size={18} color={D.primary} />
                        </View>
                        <View style={styles.serviceTexts}>
                          <Text style={styles.serviceName}>Novo serviço</Text>
                          <Text style={styles.serviceMeta}>Preencha os dados para publicar</Text>
                        </View>
                      </View>
                    </View>

                    {renderServiceForm({
                      draft: newServiceDraft,
                      serviceId: NEW_SERVICE_DRAFT,
                      isSaving: savingServiceId === NEW_SERVICE_DRAFT,
                      saveLabel: 'Criar serviço',
                      onCancel: () => {
                        setNewServiceDraft(createEmptyServiceDraft());
                        setAddingService(false);
                      },
                      onSave: handleCreateService,
                    })}
                  </View>
                )}

                {services.map(service => {
                  const ServiceIcon = getShopServiceIcon(service);
                  const draft = serviceDrafts[service.id] ?? toServiceDraft(service);
                  const isSavingService = savingServiceId === service.id;
                  const isSavedService = savedServiceId === service.id;
                  const isEditingService = editingServiceId === service.id;
                  return (
                    <View key={service.id} style={styles.serviceEditor}>
                      <View style={styles.serviceEditorHeader}>
                        <View style={styles.serviceRowLeft}>
                          <View style={styles.serviceIconWrap}>
                            <ServiceIcon size={18} color={D.primary} />
                          </View>
                          <View style={styles.serviceTexts}>
                            <Text style={styles.serviceName}>{service.name}</Text>
                            <Text style={styles.serviceMeta}>
                              {service.durationMin}min · {formatUtils.currency(service.price)}
                            </Text>
                            <Text style={styles.serviceVehicleMeta}>
                              {getServiceVehicleSummary(service)}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.serviceStatus}>
                          <Text style={styles.serviceStatusText}>
                            {service.active ? 'Ativo' : 'Oculto'}
                          </Text>
                          <Switch
                            value={service.active}
                            onValueChange={active => handleToggleService(service.id, active)}
                            thumbColor={service.active ? D.primary : D.ink3}
                            trackColor={{
                              false: D.border,
                              true: D.primaryLight,
                            }}
                          />
                        </View>
                      </View>

                      {isEditingService ? (
                        renderServiceForm({
                          draft,
                          serviceId: service.id,
                          isSaving: isSavingService,
                          isSaved: isSavedService,
                          saveLabel: 'Salvar serviço',
                          onCancel: () => setEditingServiceId(null),
                          onSave: () => handleSaveService(service),
                        })
                      ) : (
                        <View style={styles.serviceActions}>
                          <TouchableOpacity
                            style={styles.serviceEditBtn}
                            onPress={() => handleEditService(service)}
                            activeOpacity={0.8}
                          >
                            <Pencil size={14} color={D.primary} />
                            <Text style={styles.serviceEditText}>Editar serviço</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.serviceDeleteBtn}
                            onPress={() => handleDeleteService(service)}
                            activeOpacity={0.8}
                          >
                            <Trash2 size={14} color={D.status.error} />
                            <Text style={styles.serviceDeleteText}>Excluir</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Sair ── */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
            <LogOut size={18} color={D.status.error} />
            <Text style={styles.signOutText}>Sair da conta</Text>
          </TouchableOpacity>

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </SafeAreaView>

      <SelectModal
        title="Duração do serviço"
        visible={durationPickerFor !== null}
        value={
          durationPickerFor === NEW_SERVICE_DRAFT
            ? newServiceDraft.durationMin
            : durationPickerFor
            ? serviceDrafts[durationPickerFor]?.durationMin ?? null
            : null
        }
        options={DURATION_OPTIONS}
        onClose={() => setDurationPickerFor(null)}
        onSelect={value => {
          if (durationPickerFor) updateServiceDraft(durationPickerFor, 'durationMin', value);
        }}
      />

      <ConfirmModal
        visible={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel ?? ''}
        destructive={confirm?.destructive}
        onConfirm={() => {
          const c = confirm;
          setConfirm(null);
          c?.onConfirm();
        }}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

function createStyles(D: AppColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: D.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: D.bg,
      borderBottomWidth: 1,
      borderBottomColor: D.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: D.surface,
      borderWidth: 1,
      borderColor: D.border,
    },
    headerTitle: {
      fontSize: 20,
      fontFamily: T.family.extraBold,
      color: D.ink,
    },
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
    },
    card: {
      backgroundColor: D.card,
      borderRadius: radii.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: D.border,
      shadowColor: D.ink,
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    cardIconWrap: {
      width: 32,
      height: 32,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: {
      fontSize: 16,
      fontFamily: T.family.bold,
      color: D.ink,
    },
    cardDesc: {
      fontSize: 13,
      fontFamily: T.family.regular,
      color: D.ink2,
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    nameInput: {
      borderWidth: 1.5,
      borderColor: D.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 15,
      fontFamily: T.family.regular,
      color: D.ink,
      backgroundColor: D.surface,
      marginBottom: spacing.md,
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      height: 48,
      backgroundColor: D.primary,
      borderRadius: radii.md,
      marginTop: spacing.md,
    },
    saveBtnDisabled: {
      backgroundColor: D.ink3,
    },
    saveBtnText: {
      color: D.onPrimary,
      fontSize: 15,
      fontFamily: T.family.bold,
    },
    divider: {
      height: 1,
      backgroundColor: D.border,
      marginVertical: spacing.md,
    },
    servicesList: {
      gap: spacing.md,
    },
    addServiceBtn: {
      height: 42,
      borderRadius: radii.sm,
      borderWidth: 1.5,
      borderColor: D.primary,
      backgroundColor: D.card,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    addServiceText: {
      color: D.primary,
      fontSize: 14,
      fontFamily: T.family.bold,
    },
    serviceEditor: {
      borderWidth: 1,
      borderColor: D.border,
      borderRadius: radii.md,
      padding: spacing.md,
      backgroundColor: D.surface,
    },
    serviceEditorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    serviceRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    serviceIconWrap: {
      width: 36,
      height: 36,
      borderRadius: radii.sm,
      backgroundColor: D.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    serviceTexts: {
      flex: 1,
    },
    serviceName: {
      fontSize: 15,
      fontFamily: T.family.bold,
      color: D.ink,
      marginBottom: 2,
    },
    serviceMeta: {
      fontSize: 12,
      color: D.ink3,
      fontFamily: T.family.semiBold,
    },
    serviceVehicleMeta: {
      fontSize: 11,
      fontFamily: T.family.regular,
      color: D.ink2,
      marginTop: 2,
    },
    serviceStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    serviceStatusText: {
      fontSize: 12,
      color: D.ink3,
      fontFamily: T.family.bold,
    },
    serviceForm: {
      gap: spacing.xs,
    },
    serviceActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    serviceEditBtn: {
      flex: 1,
      height: 40,
      borderRadius: radii.sm,
      borderWidth: 1.5,
      borderColor: D.primary,
      backgroundColor: D.card,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    serviceEditText: {
      color: D.primary,
      fontSize: 13,
      fontFamily: T.family.bold,
    },
    serviceDeleteBtn: {
      height: 40,
      borderRadius: radii.sm,
      borderWidth: 1.5,
      borderColor: D.status.error,
      backgroundColor: D.card,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    serviceDeleteText: {
      color: D.status.error,
      fontSize: 13,
      fontFamily: T.family.bold,
    },
    inputLabel: {
      fontSize: 12,
      fontFamily: T.family.bold,
      color: D.ink3,
      marginTop: spacing.xs,
    },
    serviceInput: {
      borderWidth: 1,
      borderColor: D.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 14,
      fontFamily: T.family.regular,
      color: D.ink,
      backgroundColor: D.card,
    },
    durationSelect: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
    },
    // Preço fica lado a lado com Duração — mesma altura (paddingVertical md).
    priceInput: {
      paddingVertical: spacing.md,
    },
    durationSelectText: {
      fontSize: 14,
      fontFamily: T.family.regular,
      color: D.ink,
    },
    chipGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    optionChip: {
      borderWidth: 1,
      borderColor: D.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
      backgroundColor: D.card,
    },
    optionChipActive: {
      borderColor: D.primary,
      backgroundColor: D.primaryLight,
    },
    optionChipText: {
      fontSize: 12,
      fontFamily: T.family.bold,
      color: D.ink2,
    },
    optionChipTextActive: {
      color: D.primary,
    },
    serviceTextarea: {
      minHeight: 78,
      textAlignVertical: 'top',
    },
    serviceTextareaSmall: {
      minHeight: 62,
      textAlignVertical: 'top',
    },
    serviceInlineFields: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    inlineField: {
      flex: 1,
    },
    serviceSaveBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      height: 42,
      backgroundColor: D.primary,
      borderRadius: radii.sm,
    },
    serviceEditActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    serviceCancelBtn: {
      flex: 1,
      height: 42,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: D.border,
      backgroundColor: D.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    serviceCancelText: {
      color: D.ink2,
      fontSize: 14,
      fontFamily: T.family.bold,
    },
    serviceSaveText: {
      color: D.onPrimary,
      fontSize: 14,
      fontFamily: T.family.bold,
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stepperLabelWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flex: 1,
    },
    stepperLabel: {
      fontSize: 14,
      fontFamily: T.family.semiBold,
      color: D.ink2,
      flex: 1,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: D.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: D.border,
      paddingHorizontal: spacing.xs,
      paddingVertical: 4,
    },
    stepperBtn: {
      padding: 4,
    },
    stepperValue: {
      fontSize: 15,
      fontFamily: T.family.bold,
      color: D.ink,
      minWidth: 52,
      textAlign: 'center',
    },
    pillGroup: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    pill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radii.sm,
      borderWidth: 1.5,
      borderColor: D.border,
      backgroundColor: D.surface,
    },
    pillActive: {
      backgroundColor: D.primary,
      borderColor: D.primary,
    },
    pillText: {
      fontSize: 12,
      fontFamily: T.family.semiBold,
      color: D.ink2,
    },
    pillTextActive: {
      color: D.onPrimary,
    },

    weekDaysRow: {
      flexDirection: 'row',
      gap: 5,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    weekDayChip: {
      flex: 1,
      height: 40,
      borderRadius: radii.sm,
      borderWidth: 1.5,
      borderColor: D.border,
      backgroundColor: D.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weekDayChipActive: {
      backgroundColor: D.primary,
      borderColor: D.primary,
    },
    weekDayText: {
      fontSize: 11,
      fontFamily: T.family.bold,
      color: D.ink3,
    },
    weekDayTextActive: {
      color: D.onPrimary,
    },

    signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      height: 52,
      borderRadius: radii.md,
      borderWidth: 1.5,
      borderColor: D.status.error,
      backgroundColor: D.card,
    },
    signOutText: {
      fontSize: 15,
      fontFamily: T.family.bold,
      color: D.status.error,
    },
  });
}
