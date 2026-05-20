// src/features/appointments/screens/AppointmentScreen.tsx
import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  View,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from '@react-native-firebase/auth';
import { doc, getFirestore, setDoc } from '@react-native-firebase/firestore';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Car,
  Info,
  ChevronRight,
  X,
  Check,
  Sparkles,
} from 'lucide-react-native';

import type { RootStackParamList } from '@app/types';
import { useShop, useShopServices, getShopServiceIcon } from '@features/shops';
import type { ShopService } from '@features/shops';
import {
  getAvailableSlotsForDay,
  createAppointmentWithCapacityCheck,
  type Slot,
} from '@features/appointments';
import { CAR_CATEGORIES, type VehicleType, type CarCategory } from '@features/appointments';
import { colors, spacing, radii, typography as T } from '@shared/theme';
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
                <Icon size={28} color={colors.primary.main} />
              </View>
              <View style={styles.detailsTitleContainer}>
                <Text style={styles.detailsTitle}>{details.title}</Text>
                <Text style={styles.detailsSubtitle}>{details.description}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.priceDurationRow}>
              <View style={styles.priceBadge}>
                <Text style={styles.priceBadgeLabel}>Valor</Text>
                <Text style={styles.priceBadgeValue}>{formatUtils.currency(price)}</Text>
              </View>
              <View style={styles.durationBadge}>
                <Clock size={14} color={colors.text.secondary} />
                <Text style={styles.durationBadgeText}>{durationText}</Text>
              </View>
            </View>

            <View style={styles.detailsSection}>
              <View style={styles.sectionHeader}>
                <View
                  style={[styles.sectionIcon, { backgroundColor: colors.status.success + '20' }]}
                >
                  <Check size={14} color={colors.status.success} />
                </View>
                <Text style={styles.sectionHeaderTitle}>Inclui</Text>
              </View>
              <View style={styles.itemsGrid}>
                {details.includes.map((item, idx) => {
                  const ItemIcon = item.icon;
                  return (
                    <View key={`inc-${idx}`} style={styles.includedItem}>
                      <View
                        style={[styles.itemIcon, { backgroundColor: colors.status.success + '10' }]}
                      >
                        <ItemIcon size={12} color={colors.status.success} />
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
                  <View
                    style={[styles.sectionIcon, { backgroundColor: colors.primary.main + '20' }]}
                  >
                    <Sparkles size={14} color={colors.primary.main} />
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
              <Info size={14} color={colors.text.tertiary} />
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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalCard}>
          <View style={styles.modalCardHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={18} color={colors.text.tertiary} />
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
                      <Check size={14} color={colors.primary.main} />
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

  const selectedService = useMemo(
    () => services.find(s => s.name === serviceLabel) ?? null,
    [serviceLabel, services],
  );

  const finalPrice = selectedService?.price ?? 0;

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
      } catch (error) {
        console.error(error);
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
    const svc = services.find(s => s.name === serviceName);
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
        console.error(error);
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
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.main} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* Header sem ícone de calendário */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={18} color={colors.text.primary} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Agendar</Text>

          <View style={styles.headerRight} />
        </View>

        <SelectModal
          visible={categoryModalOpen}
          title="Categoria"
          options={CAR_CATEGORIES}
          selected={carCategory}
          onSelect={value => setCarCategory(value)}
          onClose={() => setCategoryModalOpen(false)}
        />

        <SelectModal
          visible={serviceModalOpen}
          title="Serviço"
          options={services.map(s => s.name)}
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
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DATA</Text>
            <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDayPicker(true)}>
              <View style={styles.dateSelectorContent}>
                <Calendar size={18} color={colors.primary.main} />
                <Text style={styles.dateSelectorText}>{dateUtils.formatDate(day.getTime())}</Text>
              </View>
              <ChevronRight size={16} color={colors.text.tertiary} />
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
            <Text style={styles.sectionLabel}>VEÍCULO</Text>
            <View style={styles.vehicleGrid}>
              <TouchableOpacity
                style={[styles.vehicleCard, vehicleType === 'Carro' && styles.vehicleCardSelected]}
                onPress={() => {
                  setVehicleType('Carro');
                  if (!carCategory) setCarCategory('Hatch');
                }}
              >
                <Car
                  size={16}
                  color={vehicleType === 'Carro' ? colors.primary.main : colors.text.tertiary}
                />
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
                style={[styles.vehicleCard, vehicleType === 'Moto' && styles.vehicleCardSelected]}
                onPress={() => {
                  setVehicleType('Moto');
                  setCarCategory(null);
                }}
              >
                <Car
                  size={16}
                  color={vehicleType === 'Moto' ? colors.primary.main : colors.text.tertiary}
                />
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

          {vehicleType === 'Carro' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CATEGORIA</Text>
              <TouchableOpacity style={styles.selector} onPress={() => setCategoryModalOpen(true)}>
                <View style={styles.selectorContent}>
                  <Car size={16} color={colors.text.secondary} />
                  <Text style={[styles.selectorText, !carCategory && styles.selectorPlaceholder]}>
                    {carCategory ?? 'Selecione'}
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SERVIÇO</Text>

            {selectedService ? (
              <TouchableOpacity
                style={styles.serviceCard}
                onPress={() => setServiceModalOpen(true)}
              >
                <View style={styles.serviceCardLeft}>
                  <View style={styles.serviceIconContainer}>
                    <SelectedServiceIcon size={18} color={colors.primary.main} />
                  </View>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{selectedService.name}</Text>
                    <Text style={styles.serviceDuration}>
                      {selectedService?.durationMin}min • {formatUtils.currency(finalPrice)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.detailsBadge}
                  onPress={() => setServiceDetailsOpen(true)}
                >
                  <Info size={11} color={colors.primary.main} />
                  <Text style={styles.detailsBadgeText}>Detalhes</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ) : loadingServices ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={colors.primary.main} />
                <Text style={styles.loadingText}>Carregando serviços...</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.selector, services.length === 0 && styles.selectorDisabled]}
                onPress={() => services.length > 0 && setServiceModalOpen(true)}
                disabled={services.length === 0}
              >
                <View style={styles.selectorContent}>
                  <Clock size={16} color={colors.text.secondary} />
                  <Text style={styles.selectorPlaceholder}>
                    {services.length > 0 ? 'Selecione um serviço' : 'Nenhum serviço disponível'}
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>HORÁRIOS</Text>
              {selectedService && slots.length > 0 && (
                <View style={styles.slotCountBadge}>
                  <Text style={styles.slotCountText}>{slots.length}</Text>
                </View>
              )}
            </View>

            {!selectedService ? (
              <View style={styles.emptyState}>
                <Clock size={20} color={colors.text.disabled} />
                <Text style={styles.emptyStateTitle}>Selecione um serviço</Text>
              </View>
            ) : loadingSlots ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={colors.primary.main} />
                <Text style={styles.loadingText}>Carregando...</Text>
              </View>
            ) : slots.length === 0 ? (
              <View style={styles.emptyState}>
                <Calendar size={20} color={colors.text.disabled} />
                <Text style={styles.emptyStateTitle}>Nenhum horário</Text>
              </View>
            ) : (
              <FlatList
                horizontal
                data={slots}
                keyExtractor={item => String(item.startAtMs)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.slotsList}
                renderItem={({ item }) => {
                  const isSelected = selectedSlot?.startAtMs === item.startAtMs;
                  return (
                    <TouchableOpacity
                      style={[styles.slotCard, isSelected && styles.slotCardSelected]}
                      onPress={() => setSelectedSlot(item)}
                    >
                      <Text style={[styles.slotTime, isSelected && styles.slotTimeSelected]}>
                        {dateUtils.formatHour(item.startAtMs)}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>

          {canConfirm && (
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatUtils.currency(finalPrice)}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
            onPress={handleSave}
            disabled={!canConfirm || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.text.white} />
            ) : (
              <Text style={styles.confirmButtonText}>
                {canConfirm ? 'Confirmar agendamento' : 'Selecione os dados'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ height: spacing.lg }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background.main,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.main,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.main,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.main,
  },
  headerTitle: {
    fontFamily: T.family.medium,
    fontSize: T.size.title,
    lineHeight: T.lineHeight.title,
    fontWeight: '700',
    color: colors.text.primary,
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
    paddingTop: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
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
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    letterSpacing: 0.8,
  },

  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    backgroundColor: colors.background.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border.main,
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
    color: colors.text.primary,
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
    height: 44,
    backgroundColor: colors.background.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border.main,
    paddingHorizontal: spacing.md,
  },
  vehicleCardSelected: {
    backgroundColor: colors.primary.light,
    borderColor: colors.primary.main,
  },
  vehicleLabel: {
    fontFamily: T.family.medium,
    fontSize: T.size.secondary,
    lineHeight: T.lineHeight.secondary,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  vehicleLabelSelected: {
    color: colors.primary.main,
  },

  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    backgroundColor: colors.background.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border.main,
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
    color: colors.text.primary,
    fontWeight: '500',
  },
  selectorPlaceholder: {
    fontFamily: T.family.regular,
    fontSize: T.size.body,
    lineHeight: T.lineHeight.body,
    color: colors.text.disabled,
  },

  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border.main,
    padding: spacing.md,
  },
  serviceCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  serviceIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.primary.light,
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
    color: colors.text.primary,
    marginBottom: 2,
  },
  serviceDuration: {
    fontFamily: T.family.regular,
    fontSize: T.size.secondary,
    lineHeight: T.lineHeight.secondary,
    color: colors.text.tertiary,
  },
  detailsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary.light,
    borderRadius: 16,
  },
  detailsBadgeText: {
    fontFamily: T.family.medium,
    fontSize: T.size.caption,
    lineHeight: T.lineHeight.caption,
    fontWeight: '600',
    color: colors.primary.main,
  },

  slotsList: {
    gap: spacing.xs,
    paddingVertical: 4,
  },
  slotCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border.main,
  },
  slotCardSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  slotTime: {
    fontFamily: T.family.medium,
    fontSize: T.size.secondary,
    lineHeight: T.lineHeight.secondary,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  slotTimeSelected: {
    color: colors.text.white,
  },
  slotCountBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    backgroundColor: colors.primary.light,
    borderRadius: 12,
  },
  slotCountText: {
    fontFamily: T.family.medium,
    fontSize: T.size.caption,
    lineHeight: T.lineHeight.caption,
    fontWeight: '600',
    color: colors.primary.main,
  },

  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border.main,
  },
  emptyStateTitle: {
    fontFamily: T.family.regular,
    fontSize: T.size.secondary,
    lineHeight: T.lineHeight.secondary,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  loadingState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border.main,
  },
  loadingText: {
    fontFamily: T.family.regular,
    fontSize: T.size.secondary,
    lineHeight: T.lineHeight.secondary,
    color: colors.text.secondary,
  },

  totalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary.light,
    borderRadius: radii.sm,
    padding: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  totalLabel: {
    fontFamily: T.family.medium,
    fontSize: T.size.body,
    lineHeight: T.lineHeight.body,
    fontWeight: '600',
    color: colors.primary.main,
  },
  totalValue: {
    fontFamily: T.family.medium,
    fontSize: T.size.title,
    lineHeight: T.lineHeight.title,
    fontWeight: '800',
    color: colors.primary.main,
  },

  confirmButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.main,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    shadowColor: colors.primary.main,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.text.disabled,
    shadowOpacity: 0,
  },
  confirmButtonText: {
    fontFamily: T.family.medium,
    fontSize: T.size.body,
    lineHeight: T.lineHeight.body,
    fontWeight: '700',
    color: colors.text.white,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.background.main,
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
    borderBottomColor: colors.border.main,
  },
  modalTitle: {
    fontFamily: T.family.medium,
    fontSize: T.size.body,
    lineHeight: T.lineHeight.body,
    fontWeight: '700',
    color: colors.text.primary,
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
    backgroundColor: colors.primary.light,
  },
  modalItemText: {
    fontFamily: T.family.regular,
    fontSize: T.size.body,
    lineHeight: T.lineHeight.body,
    fontWeight: '500',
    color: colors.text.primary,
  },
  modalItemTextSelected: {
    color: colors.primary.main,
    fontWeight: '600',
  },
  modalItemCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailsModal: {
    backgroundColor: colors.background.main,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border.main,
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
    backgroundColor: colors.primary.light,
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
    color: colors.text.primary,
    marginBottom: 2,
  },
  detailsSubtitle: {
    fontFamily: T.family.regular,
    fontSize: T.size.secondary,
    lineHeight: T.lineHeight.secondary,
    color: colors.text.tertiary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.surface,
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
    backgroundColor: colors.primary.light,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  priceBadgeLabel: {
    fontFamily: T.family.medium,
    fontSize: T.size.caption,
    lineHeight: T.lineHeight.caption,
    fontWeight: '600',
    color: colors.primary.main,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceBadgeValue: {
    fontFamily: T.family.medium,
    fontSize: T.size.titleLarge,
    lineHeight: T.lineHeight.titleLarge,
    fontWeight: '800',
    color: colors.primary.main,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.main,
  },
  durationBadgeText: {
    fontFamily: T.family.medium,
    fontSize: T.size.secondary,
    lineHeight: T.lineHeight.secondary,
    fontWeight: '600',
    color: colors.text.secondary,
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
    color: colors.text.primary,
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
    color: colors.text.primary,
    fontWeight: '500',
  },
  excludedItemText: {
    flex: 1,
    fontFamily: T.family.regular,
    fontSize: T.size.secondary,
    lineHeight: T.lineHeight.secondary,
    color: colors.text.tertiary,
  },
  recommendedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recommendedTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.main,
  },
  recommendedTagText: {
    fontFamily: T.family.regular,
    fontSize: T.size.caption,
    lineHeight: T.lineHeight.caption,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.background.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noteText: {
    flex: 1,
    fontFamily: T.family.regular,
    fontSize: T.size.secondary,
    color: colors.text.tertiary,
    lineHeight: T.lineHeight.secondary,
  },
  detailsActionButton: {
    backgroundColor: colors.primary.main,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  detailsActionButtonText: {
    fontFamily: T.family.medium,
    fontSize: T.size.body,
    lineHeight: T.lineHeight.body,
    fontWeight: '700',
    color: colors.text.white,
  },
});
