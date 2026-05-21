// src/features/appointments/screens/AppointmentScreen.tsx
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from '@react-native-firebase/auth';
import { doc, getDoc, getFirestore, setDoc } from '@react-native-firebase/firestore';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Car,
  Check,
  ChevronRight,
  Clock,
  Info,
  MapPin,
  Sparkles,
  X,
} from 'lucide-react-native';

import type { RootStackParamList } from '@app/types';
import {
  useShop,
  useShopServices,
  getShopServiceIcon,
  serviceSupportsVehicle,
} from '@features/shops';
import type { ShopService } from '@features/shops';
import {
  getAvailableSlotsForDay,
  createAppointmentWithCapacityCheck,
  type Slot,
} from '@features/appointments';
import {
  CAR_CATEGORIES,
  VEHICLE_TYPES,
  type VehicleType,
  type CarCategory,
} from '@features/appointments';
import { spacing, radii, typography as T, useAppTheme, type AppColors } from '@shared/theme';
import { formatUtils } from '@shared/utils/format.utils';
import { dateUtils } from '@shared/utils/date.utils';

const { height } = Dimensions.get('window');

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type ServiceDetails = {
  title: string;
  description: string;
  duration: string;
  includes: Array<{ text: string; icon: any }>;
  note: string;
  recommendedFor: string[];
};

function getServiceDetails(service: ShopService): ServiceDetails {
  const includes =
    service.includes && service.includes.length > 0
      ? service.includes.map(text => ({ text, icon: Check }))
      : [{ text: service.description ?? 'Execução do serviço selecionado', icon: Check }];

  return {
    title: service.name,
    description: service.description ?? 'Serviço da estética',
    duration: `${service.durationMin} min`,
    includes,
    note: service.note ?? 'Os detalhes deste serviço são definidos pela estética.',
    recommendedFor:
      service.recommendedFor && service.recommendedFor.length > 0
        ? service.recommendedFor
        : ['Cliente vinculado'],
  };
}

function ServiceDetailsModal({
  visible,
  service,
  price,
  onClose,
}: {
  visible: boolean;
  service: ShopService | null;
  price: number;
  onClose: () => void;
}) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [fadeAnim, slideAnim, visible]);

  if (!visible || !service) return null;

  const details = getServiceDetails(service);
  const durationText = `${service.durationMin} min`;
  const Icon = getShopServiceIcon(service);

  return (
    <Modal transparent visible={visible} onRequestClose={onClose}>
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.detailsModal,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.modalHandle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}
          >
            <View style={styles.detailsHeader}>
              <View style={styles.detailsIconContainer}>
                <Icon size={28} color={D.primary} />
              </View>
              <View style={styles.detailsTitleContainer}>
                <Text style={styles.detailsTitle}>{details.title}</Text>
                <Text style={styles.detailsSubtitle}>{details.description}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={18} color={D.ink3} />
              </TouchableOpacity>
            </View>

            <View style={styles.priceDurationRow}>
              <View style={styles.priceBadge}>
                <Text style={styles.priceBadgeLabel}>Valor</Text>
                <Text style={styles.priceBadgeValue}>{formatUtils.currency(price)}</Text>
              </View>
              <View style={styles.durationBadge}>
                <Clock size={14} color={D.ink2} />
                <Text style={styles.durationBadgeText}>{durationText}</Text>
              </View>
            </View>

            <View style={styles.detailsSection}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: D.status.success + '20' }]}>
                  <Check size={14} color={D.status.success} />
                </View>
                <Text style={styles.sectionHeaderTitle}>Inclui</Text>
              </View>
              <View style={styles.itemsGrid}>
                {details.includes.map((item, idx) => {
                  const ItemIcon = item.icon;
                  return (
                    <View key={`inc-${idx}`} style={styles.includedItem}>
                      <View style={[styles.itemIcon, { backgroundColor: D.status.success + '10' }]}>
                        <ItemIcon size={12} color={D.status.success} />
                      </View>
                      <Text style={styles.includedItemText}>{item.text}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {details.recommendedFor && (
              <View style={styles.detailsSection}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: D.primary + '20' }]}>
                    <Sparkles size={14} color={D.primary} />
                  </View>
                  <Text style={styles.sectionHeaderTitle}>Recomendado</Text>
                </View>
                <View style={styles.recommendedTags}>
                  {details.recommendedFor.map((item, idx) => (
                    <View key={`rec-${idx}`} style={styles.recommendedTag}>
                      <Text style={styles.recommendedTagText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.noteContainer}>
              <Info size={14} color={D.ink3} />
              <Text style={styles.noteText}>{details.note}</Text>
            </View>

            <TouchableOpacity
              style={styles.detailsActionButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.detailsActionButtonText}>Continuar</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function SelectModal<T extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly T[];
  selected: T | null;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalCard}>
          <View style={styles.modalCardHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={18} color={D.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {options.map(opt => {
              const isSelected = opt === selected;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                  onPress={() => {
                    onSelect(opt);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                    {opt}
                  </Text>
                  {isSelected && (
                    <View style={styles.modalItemCheck}>
                      <Check size={14} color={D.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function AppointmentScreen() {
  const { colors: D, isLight } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const auth = getAuth();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Appointment'>>();
  const uid = auth.currentUser?.uid;

  // shopId pode vir por param (vindo de ShopProfile) ou do shop padrão do user
  const { shopId: defaultShopId } = useShop();
  const shopId = route.params?.shopId ?? defaultShopId;

  const { loading: loadingServices, items: services } = useShopServices({
    shopId,
    activeOnly: true,
  });

  // Hero: info do shop para o cliente sempre saber em qual estética está agendando
  const [shopInfo, setShopInfo] = useState<{
    name: string;
    address?: string;
    city?: string;
  } | null>(null);

  React.useEffect(() => {
    if (!shopId) {
      setShopInfo(null);
      return;
    }
    let mounted = true;
    getDoc(doc(getFirestore(), 'shops', shopId))
      .then(snap => {
        if (!mounted || !snap.exists()) return;
        const data = snap.data() as {
          name?: string;
          location?: { address?: string; city?: string };
        };
        setShopInfo({
          name: data.name ?? 'Estética',
          address: data.location?.address,
          city: data.location?.city,
        });
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [shopId]);

  const [vehicleType, setVehicleType] = useState<VehicleType>('Carro');
  const [carCategory, setCarCategory] = useState<CarCategory | null>('Hatch');
  const [serviceLabel, setServiceLabel] = useState<string | null>(null);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceDetailsOpen, setServiceDetailsOpen] = useState(false);

  const [day, setDay] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const availableVehicleTypes = useMemo(
    () =>
      VEHICLE_TYPES.filter(type =>
        services.some(service =>
          type === 'Moto'
            ? serviceSupportsVehicle(service, 'Moto', null)
            : service.vehicleTypes.includes('Carro') && service.carCategories.length > 0,
        ),
      ),
    [services],
  );

  const availableCarCategories = useMemo(
    () =>
      CAR_CATEGORIES.filter(category =>
        services.some(service => serviceSupportsVehicle(service, 'Carro', category)),
      ),
    [services],
  );

  const compatibleServices = useMemo(
    () =>
      services.filter(service =>
        serviceSupportsVehicle(service, vehicleType, vehicleType === 'Carro' ? carCategory : null),
      ),
    [carCategory, services, vehicleType],
  );

  const selectedService = useMemo(
    () => compatibleServices.find(s => s.name === serviceLabel) ?? null,
    [compatibleServices, serviceLabel],
  );

  const finalPrice = selectedService?.price ?? 0;

  useEffect(() => {
    if (loadingServices || services.length === 0) return;
    if (availableVehicleTypes.includes(vehicleType)) return;

    const nextVehicle = availableVehicleTypes[0];
    if (!nextVehicle) return;

    setVehicleType(nextVehicle);
    setCarCategory(nextVehicle === 'Carro' ? availableCarCategories[0] ?? null : null);
  }, [
    availableCarCategories,
    availableVehicleTypes,
    loadingServices,
    services.length,
    vehicleType,
  ]);

  useEffect(() => {
    if (vehicleType !== 'Carro') return;
    if (carCategory && availableCarCategories.includes(carCategory)) return;
    setCarCategory(availableCarCategories[0] ?? null);
  }, [availableCarCategories, carCategory, vehicleType]);

  useEffect(() => {
    if (!serviceLabel) return;
    if (selectedService) return;
    setServiceLabel(null);
    setSlots([]);
    setSelectedSlot(null);
  }, [selectedService, serviceLabel]);

  const refreshSlots = useCallback(
    async (nextDay: Date, nextService = selectedService) => {
      if (!nextService) {
        setSlots([]);
        setSelectedSlot(null);
        return;
      }

      try {
        setLoadingSlots(true);
        const list = await getAvailableSlotsForDay(nextDay, nextService.durationMin, shopId ?? '');
        setSlots(list);
        setSelectedSlot(null);
      } catch {
        setSlots([]);
        setSelectedSlot(null);
        Alert.alert('Erro', 'Não foi possível carregar os horários.');
      } finally {
        setLoadingSlots(false);
      }
    },
    [selectedService, shopId],
  );

  const handleDayChange = async (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      setShowDayPicker(false);
      return;
    }
    setShowDayPicker(false);
    if (!selected) return;

    const next = new Date(selected);
    next.setHours(0, 0, 0, 0);
    setDay(next);
    await refreshSlots(next, selectedService);
  };

  const handleSelectService = async (serviceName: string) => {
    setServiceLabel(serviceName);
    const svc = compatibleServices.find(s => s.name === serviceName);
    if (!svc) return;
    await refreshSlots(day, svc);
  };

  const handleSave = async () => {
    if (!selectedService) {
      Alert.alert('Atenção', 'Selecione um serviço.');
      return;
    }

    if (vehicleType === 'Carro' && !carCategory) {
      Alert.alert('Atenção', 'Selecione a categoria do veículo.');
      return;
    }

    if (!selectedSlot) {
      Alert.alert('Atenção', 'Selecione um horário.');
      return;
    }

    try {
      setSubmitting(true);
      await createAppointmentWithCapacityCheck({
        shopId: shopId ?? '',
        customerUid: uid!,
        vehicleType,
        carCategory: vehicleType === 'Carro' ? carCategory : null,
        serviceLabel: selectedService.name,
        durationMin: selectedService.durationMin,
        price: finalPrice,
        startAtMs: selectedSlot.startAtMs,
        endAtMs: selectedSlot.endAtMs,
      });

      // Salva o shopId no user como "última estética usada"
      if (uid && shopId) {
        await setDoc(doc(getFirestore(), 'users', uid), { shopId }, { merge: true }).catch(() => {
          // se falhar, não interrompe o fluxo do agendamento
        });
      }

      Alert.alert('Sucesso!', 'Seu agendamento foi confirmado.', [
        {
          text: 'Ver agendamentos',
          onPress: () => navigation.replace('Dashboard'),
        },
      ]);
    } catch (error: any) {
      if (error?.code === 'SLOT_FULL') {
        Alert.alert('Horário indisponível', 'Selecione outro horário.');
        await refreshSlots(day, selectedService);
      } else {
        Alert.alert('Erro', 'Não foi possível realizar o agendamento.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!uid) {
    return null;
  }

  const canConfirm = !!selectedService && !!selectedSlot && !submitting;
  const SelectedServiceIcon = selectedService ? getShopServiceIcon(selectedService) : Calendar;

  return (
    <>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* Header sem ícone de calendário */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={18} color={D.ink} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Agendar</Text>

          <View style={styles.headerRight} />
        </View>

        <SelectModal
          visible={categoryModalOpen}
          title="Categoria"
          options={availableCarCategories}
          selected={carCategory}
          onSelect={value => setCarCategory(value)}
          onClose={() => setCategoryModalOpen(false)}
        />

        <SelectModal
          visible={serviceModalOpen}
          title="Serviço"
          options={compatibleServices.map(s => s.name)}
          selected={serviceLabel}
          onSelect={handleSelectService}
          onClose={() => setServiceModalOpen(false)}
        />

        <ServiceDetailsModal
          visible={serviceDetailsOpen}
          service={selectedService}
          price={finalPrice}
          onClose={() => setServiceDetailsOpen(false)}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {shopInfo && (
            <View style={styles.heroCard}>
              <Text style={styles.heroShopName} numberOfLines={1}>
                {shopInfo.name}
              </Text>
              {(shopInfo.address || shopInfo.city) && (
                <View style={styles.heroMetaRow}>
                  <MapPin size={13} color={D.ink3} />
                  <Text style={styles.heroMetaText} numberOfLines={2}>
                    {[shopInfo.address, shopInfo.city].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              <Text style={styles.sectionNumber}>01 </Text>· QUANDO
            </Text>
            <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDayPicker(true)}>
              <View style={styles.dateSelectorContent}>
                <Calendar size={18} color={D.primary} />
                <Text style={styles.dateSelectorText}>{dateUtils.formatDate(day.getTime())}</Text>
              </View>
              <ChevronRight size={16} color={D.ink3} />
            </TouchableOpacity>
          </View>

          {showDayPicker && (
            <DateTimePicker
              value={day}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={handleDayChange}
              minimumDate={new Date()}
            />
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              <Text style={styles.sectionNumber}>02 </Text>· VEÍCULO
            </Text>
            <View style={styles.vehicleGrid}>
              <TouchableOpacity
                style={[
                  styles.vehicleCard,
                  vehicleType === 'Carro' && styles.vehicleCardSelected,
                  !availableVehicleTypes.includes('Carro') && styles.vehicleCardDisabled,
                ]}
                onPress={() => {
                  setVehicleType('Carro');
                  if (!carCategory || !availableCarCategories.includes(carCategory)) {
                    setCarCategory(availableCarCategories[0] ?? null);
                  }
                }}
                disabled={!availableVehicleTypes.includes('Carro')}
              >
                <Car size={16} color={vehicleType === 'Carro' ? D.primary : D.ink3} />
                <Text
                  style={[
                    styles.vehicleLabel,
                    vehicleType === 'Carro' && styles.vehicleLabelSelected,
                  ]}
                >
                  Carro
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.vehicleCard,
                  vehicleType === 'Moto' && styles.vehicleCardSelected,
                  !availableVehicleTypes.includes('Moto') && styles.vehicleCardDisabled,
                ]}
                onPress={() => {
                  setVehicleType('Moto');
                  setCarCategory(null);
                }}
                disabled={!availableVehicleTypes.includes('Moto')}
              >
                <Car size={16} color={vehicleType === 'Moto' ? D.primary : D.ink3} />
                <Text
                  style={[
                    styles.vehicleLabel,
                    vehicleType === 'Moto' && styles.vehicleLabelSelected,
                  ]}
                >
                  Moto
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              <Text style={styles.sectionNumber}>03 </Text>· SERVIÇO
            </Text>

            {selectedService ? (
              <TouchableOpacity
                style={styles.serviceCard}
                onPress={() => setServiceModalOpen(true)}
              >
                <View style={styles.serviceCardLeft}>
                  <View style={styles.serviceIconContainer}>
                    <SelectedServiceIcon size={18} color={D.primary} />
                  </View>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName} numberOfLines={1}>
                      {selectedService.name}
                    </Text>
                    <Text style={styles.serviceDuration} numberOfLines={1}>
                      {selectedService?.durationMin}min • {formatUtils.currency(finalPrice)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.detailsBadge}
                  onPress={() => setServiceDetailsOpen(true)}
                  hitSlop={8}
                >
                  <Info size={11} color={D.primary} />
                  <Text style={styles.detailsBadgeText}>Detalhes</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ) : loadingServices ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={D.primary} />
                <Text style={styles.loadingText}>Carregando serviços...</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.selector,
                  compatibleServices.length === 0 && styles.selectorDisabled,
                ]}
                onPress={() => compatibleServices.length > 0 && setServiceModalOpen(true)}
                disabled={compatibleServices.length === 0}
              >
                <View style={styles.selectorContent}>
                  <Clock size={16} color={D.ink2} />
                  <Text style={styles.selectorPlaceholder}>
                    {services.length > 0
                      ? 'Nenhum serviço para este veículo'
                      : 'Nenhum serviço disponível'}
                  </Text>
                </View>
                <ChevronRight size={16} color={D.ink3} />
              </TouchableOpacity>
            )}
          </View>

          {vehicleType === 'Carro' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CATEGORIA</Text>
              {/* sub-seção condicional — depende do veículo selecionado */}
              <TouchableOpacity
                style={[
                  styles.selector,
                  availableCarCategories.length === 0 && styles.selectorDisabled,
                ]}
                onPress={() => availableCarCategories.length > 0 && setCategoryModalOpen(true)}
                disabled={availableCarCategories.length === 0}
              >
                <View style={styles.selectorContent}>
                  <Car size={16} color={D.ink2} />
                  <Text style={[styles.selectorText, !carCategory && styles.selectorPlaceholder]}>
                    {carCategory ?? 'Selecione'}
                  </Text>
                </View>
                <ChevronRight size={16} color={D.ink3} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>
                <Text style={styles.sectionNumber}>04 </Text>· HORÁRIO
              </Text>
              {selectedService && slots.length > 0 && (
                <Text style={styles.slotCountInline}>{slots.length} disponíveis</Text>
              )}
            </View>

            {!selectedService ? (
              <View style={styles.emptyState}>
                <Clock size={20} color={D.ink3} />
                <Text style={styles.emptyStateTitle}>Selecione um serviço</Text>
              </View>
            ) : loadingSlots ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={D.primary} />
                <Text style={styles.loadingText}>Carregando...</Text>
              </View>
            ) : slots.length === 0 ? (
              <View style={styles.emptyState}>
                <Calendar size={20} color={D.ink3} />
                <Text style={styles.emptyStateTitle}>Nenhum horário</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.slotsRow}
              >
                {slots.map(item => {
                  const isSelected = selectedSlot?.startAtMs === item.startAtMs;
                  return (
                    <TouchableOpacity
                      key={String(item.startAtMs)}
                      style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                      onPress={() => setSelectedSlot(item)}
                    >
                      <Text style={[styles.slotTime, isSelected && styles.slotTimeSelected]}>
                        {dateUtils.formatHour(item.startAtMs)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <View style={{ height: 96 }} />
        </ScrollView>

        {/* CTA sticky no rodapé com total embutido */}
        <View style={styles.ctaWrap}>
          <TouchableOpacity
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
            onPress={handleSave}
            disabled={!canConfirm || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={D.onPrimary} />
            ) : canConfirm ? (
              <>
                <Text style={styles.confirmButtonText}>
                  Confirmar · {formatUtils.currency(finalPrice)}
                </Text>
                <ArrowRight size={18} color={D.onPrimary} />
              </>
            ) : (
              <Text style={styles.confirmButtonText}>Selecione os dados</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
    backButton: {
      width: 36,
      height: 36,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: D.surface,
      borderWidth: 1,
      borderColor: D.border,
    },
    headerTitle: {
      fontFamily: T.family.medium,
      fontSize: T.size.title,
      lineHeight: T.lineHeight.title,
      fontWeight: '700',
      color: D.ink,
      textAlign: 'center',
      flex: 1,
    },
    headerRight: {
      width: 36,
    },

    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },

    heroCard: {
      backgroundColor: D.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: D.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      gap: 4,
      marginBottom: spacing.md,
    },
    heroShopName: {
      fontFamily: T.family.medium,
      fontSize: T.size.titleLarge,
      lineHeight: T.lineHeight.titleLarge,
      fontWeight: '800',
      color: D.ink,
    },
    heroMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    heroMetaText: {
      flex: 1,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      color: D.ink3,
    },

    section: {
      marginBottom: spacing.md,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    sectionLabel: {
      fontFamily: T.family.medium,
      fontSize: T.size.caption,
      lineHeight: T.lineHeight.caption,
      fontWeight: '700',
      color: D.ink3,
      marginBottom: spacing.xs,
      letterSpacing: 0.8,
    },
    sectionNumber: {
      color: D.primary,
      fontWeight: '800',
    },

    dateSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 42,
      backgroundColor: D.surface,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: D.border,
      paddingHorizontal: spacing.md,
    },
    dateSelectorContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dateSelectorText: {
      fontFamily: T.family.regular,
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      fontWeight: '500',
      color: D.ink,
    },

    vehicleGrid: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    vehicleCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      height: 42,
      backgroundColor: D.surface,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: D.border,
      paddingHorizontal: spacing.md,
    },
    vehicleCardSelected: {
      backgroundColor: D.primaryLight,
      borderColor: D.primary,
    },
    vehicleCardDisabled: {
      opacity: 0.35,
    },
    vehicleLabel: {
      fontFamily: T.family.medium,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      fontWeight: '600',
      color: D.ink2,
    },
    vehicleLabelSelected: {
      color: D.primary,
    },

    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 42,
      backgroundColor: D.surface,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: D.border,
      paddingHorizontal: spacing.md,
    },
    selectorDisabled: {
      opacity: 0.6,
    },
    selectorContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    selectorText: {
      fontFamily: T.family.regular,
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      color: D.ink,
      fontWeight: '500',
    },
    selectorPlaceholder: {
      fontFamily: T.family.regular,
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      color: D.ink3,
    },

    serviceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: D.surface,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: D.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    serviceCardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    serviceIconContainer: {
      width: 36,
      height: 36,
      borderRadius: radii.sm,
      backgroundColor: D.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    serviceInfo: {
      flex: 1,
    },
    serviceName: {
      fontFamily: T.family.medium,
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      fontWeight: '600',
      color: D.ink,
      marginBottom: 2,
    },
    serviceDuration: {
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      color: D.ink3,
    },
    detailsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: D.primaryLight,
      borderRadius: 999,
      flexShrink: 0,
    },
    detailsBadgeText: {
      fontFamily: T.family.medium,
      fontSize: T.size.caption,
      lineHeight: T.lineHeight.caption,
      fontWeight: '600',
      color: D.primary,
    },

    slotsRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      paddingVertical: 4,
      paddingRight: spacing.sm,
    },
    slotChip: {
      width: 76,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: D.surface,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: D.border,
    },
    slotChipSelected: {
      backgroundColor: D.primary,
      borderColor: D.primary,
    },
    slotTime: {
      fontFamily: T.family.medium,
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      fontWeight: '700',
      color: D.ink2,
    },
    slotTimeSelected: {
      color: D.onPrimary,
    },
    slotCountInline: {
      fontFamily: T.family.medium,
      fontSize: T.size.caption,
      fontWeight: '700',
      color: D.primary,
      letterSpacing: 0.3,
    },

    emptyState: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.lg,
      backgroundColor: D.surface,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: D.border,
    },
    emptyStateTitle: {
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      color: D.ink3,
      fontWeight: '500',
    },
    loadingState: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.lg,
      backgroundColor: D.surface,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: D.border,
    },
    loadingText: {
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      color: D.ink2,
    },

    ctaWrap: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      backgroundColor: D.bg,
      borderTopWidth: 1,
      borderTopColor: D.border,
    },
    confirmButton: {
      height: 52,
      borderRadius: radii.md,
      backgroundColor: D.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      shadowColor: D.primary,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    confirmButtonDisabled: {
      backgroundColor: D.ink3,
      shadowOpacity: 0,
    },
    confirmButtonText: {
      fontFamily: T.family.medium,
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      fontWeight: '800',
      color: D.onPrimary,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: D.overlay,
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: D.bg,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      paddingTop: spacing.lg,
      paddingBottom: Platform.OS === 'ios' ? 32 : spacing.lg,
      maxHeight: '70%',
    },
    modalCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: D.border,
    },
    modalTitle: {
      fontFamily: T.family.medium,
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      fontWeight: '700',
      color: D.ink,
    },
    modalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginHorizontal: spacing.lg,
      marginVertical: 2,
      borderRadius: radii.sm,
    },
    modalItemSelected: {
      backgroundColor: D.primaryLight,
    },
    modalItemText: {
      fontFamily: T.family.regular,
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      fontWeight: '500',
      color: D.ink,
    },
    modalItemTextSelected: {
      color: D.primary,
      fontWeight: '600',
    },
    modalItemCheck: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: D.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },

    detailsModal: {
      backgroundColor: D.bg,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      paddingTop: spacing.xs,
      paddingHorizontal: spacing.lg,
      maxHeight: '85%',
    },
    modalHandle: {
      width: 36,
      height: 4,
      backgroundColor: D.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    modalScrollContent: {
      paddingBottom: spacing.xl,
    },
    detailsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    detailsIconContainer: {
      width: 52,
      height: 52,
      borderRadius: radii.lg,
      backgroundColor: D.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    detailsTitleContainer: {
      flex: 1,
    },
    detailsTitle: {
      fontFamily: T.family.medium,
      fontSize: T.size.bodyLarge,
      lineHeight: T.lineHeight.bodyLarge,
      fontWeight: '700',
      color: D.ink,
      marginBottom: 2,
    },
    detailsSubtitle: {
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      color: D.ink3,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: D.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    priceDurationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    priceBadge: {
      flex: 1,
      backgroundColor: D.primaryLight,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    priceBadgeLabel: {
      fontFamily: T.family.medium,
      fontSize: T.size.caption,
      lineHeight: T.lineHeight.caption,
      fontWeight: '600',
      color: D.primary,
      marginBottom: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    priceBadgeValue: {
      fontFamily: T.family.medium,
      fontSize: T.size.titleLarge,
      lineHeight: T.lineHeight.titleLarge,
      fontWeight: '800',
      color: D.primary,
    },
    durationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: D.surface,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: D.border,
    },
    durationBadgeText: {
      fontFamily: T.family.medium,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      fontWeight: '600',
      color: D.ink2,
    },
    detailsSection: {
      marginBottom: spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    sectionHeaderTitle: {
      fontFamily: T.family.medium,
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      fontWeight: '700',
      color: D.ink,
    },
    sectionIcon: {
      width: 24,
      height: 24,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    includedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      width: '48%',
    },
    excludedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      width: '48%',
    },
    itemIcon: {
      width: 24,
      height: 24,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    includedItemText: {
      flex: 1,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      color: D.ink,
      fontWeight: '500',
    },
    excludedItemText: {
      flex: 1,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      color: D.ink3,
    },
    recommendedTags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    recommendedTag: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      backgroundColor: D.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: D.border,
    },
    recommendedTagText: {
      fontFamily: T.family.regular,
      fontSize: T.size.caption,
      lineHeight: T.lineHeight.caption,
      fontWeight: '500',
      color: D.ink2,
    },
    noteContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: D.surface,
      borderRadius: radii.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    noteText: {
      flex: 1,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      color: D.ink3,
      lineHeight: T.lineHeight.secondary,
    },
    detailsActionButton: {
      backgroundColor: D.primary,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    detailsActionButtonText: {
      fontFamily: T.family.medium,
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      fontWeight: '700',
      color: D.onPrimary,
    },
  });
}
