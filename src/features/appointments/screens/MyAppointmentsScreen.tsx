import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getAuth } from '@react-native-firebase/auth';
import { ArrowLeft } from 'lucide-react-native';

import type { RootStackParamList } from '@app/types';
import { useShop } from '@features/shops';
import { typography as T, useAppTheme, type AppColors } from '@shared/theme';
import { useNowTick } from '@shared/hooks/useNowTick';
import { usePullRefresh } from '@shared/hooks/usePullRefresh';
import { FadeInUp } from '@shared/components/FadeInUp';
import { LiveDot } from '@shared/components/LiveDot';
import { useFeedback } from '@shared/components/FeedbackProvider';
import { useUserAppointments } from '../hooks/useUserAppointments';
import type { UserAppointment } from '../domain/appointment.types';
import { ACTIVE_APPOINTMENT_SET } from '../domain/appointment.constants';
import { isExpiredScheduled } from '../domain/appointment.helpers';
import { cancelAppointment, getAppointmentRules } from '../services/appointment.service';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const appointmentSeparatorStyle = { height: 20 };

const AppointmentSeparator = memo(function AppointmentSeparator() {
  return <View style={appointmentSeparatorStyle} />;
});

function getDuration(item: UserAppointment) {
  if (item.durationMin) return `${item.durationMin} min`;
  if (item.endAtMs)
    return `${Math.max(1, Math.round((item.endAtMs - item.startAtMs) / 60000))} min`;
  return '--';
}

function getVehicleLabel(item: UserAppointment) {
  if (item.vehicleType === 'Carro') return item.carCategory ?? 'Carro';
  return item.vehicleType;
}

function getPrice(value: number | null) {
  if (value === null || value === undefined) return 'R$ --';
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

function getTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isToday(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function getDateLabel(timestamp: number) {
  if (isToday(timestamp)) return 'Hoje';

  const date = new Date(timestamp);
  const weekday = date
    .toLocaleDateString('pt-BR', { weekday: 'short' })
    .replace('.', '')
    .toLowerCase();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${weekday} ${day}/${month}`;
}

export default function MyAppointmentsScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors: D, isLight } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const auth = getAuth();
  const uid = auth.currentUser?.uid;
  const { shopId } = useShop();

  const { showSuccess, showError, showConfirm } = useFeedback();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { loading, items, mutate } = useUserAppointments({
    uid,
    shopId,
    statusIn: ACTIVE_APPOINTMENT_SET,
    limitN: 50,
  });

  // Tick de relógio: recalcula "vencido" com o tempo passando, mesmo sem mudança
  // nos dados (senão o item ficaria preso na lista até remontar a tela).
  const now = useNowTick();
  const { refreshControl, tick } = usePullRefresh(mutate);

  // Vencidos (passou do horário + tolerância) saem da lista de ativos — viram
  // "Não realizado" no Histórico. Aqui ficam só os realmente próximos/em andamento.
  const activeItems = useMemo(
    () => items.filter(item => !isExpiredScheduled(item.status, item.startAtMs, now)),
    [items, now],
  );

  const inProgressCount = useMemo(
    () => activeItems.filter(item => item.status === 'in_progress').length,
    [activeItems],
  );

  const executeCancel = useCallback(
    async (item: UserAppointment) => {
      setCancellingId(item.id);

      const result = await cancelAppointment(item.id, uid!, shopId ?? '');

      if (result.ok) {
        showSuccess(result.message);
        mutate();
      } else {
        showError(result.message);
      }

      setCancellingId(null);
    },
    [uid, shopId, mutate, showSuccess, showError],
  );

  const handleCancel = useCallback(
    (item: UserAppointment) => {
      const rules = getAppointmentRules(item);

      if (!rules.canCancel) {
        showError(rules.message || 'Cancelamento não permitido.', {
          title: 'Não é possível cancelar',
        });
        return;
      }

      showConfirm({
        title: 'Cancelar agendamento',
        message: 'Tem certeza que deseja cancelar este agendamento?',
        confirmLabel: 'Sim, cancelar',
        cancelLabel: 'Não',
        destructive: true,
        onConfirm: () => executeCancel(item),
      });
    },
    [showError, showConfirm, executeCancel],
  );

  const renderItem = useCallback(
    ({ item }: { item: UserAppointment }) => (
      <AppointmentCard
        item={item}
        isCancelling={cancellingId === item.id}
        onCancel={handleCancel}
      />
    ),
    [cancellingId, handleCancel],
  );

  if (!uid) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={D.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
          >
            <ArrowLeft size={20} color={D.ink} strokeWidth={2.4} />
          </TouchableOpacity>

          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Agendamentos</Text>
            <Text style={styles.headerMeta} numberOfLines={1}>
              {String(activeItems.length).padStart(2, '0')} ativos · {inProgressCount} em andamento
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={D.primary} />
            </View>
          ) : (
            <FadeInUp style={styles.flexFill}>
              <FlatList
                data={activeItems}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                extraData={`${now}-${tick}`}
                refreshControl={refreshControl}
                ItemSeparatorComponent={AppointmentSeparator}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateTitle}>Nenhum agendamento ativo</Text>
                    <Text style={styles.emptyStateText}>
                      Você não tem serviços agendados no momento.
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyStateButton}
                      onPress={() => navigation.navigate('Appointment', {})}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.emptyStateButtonText}>Agendar serviço</Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            </FadeInUp>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const AppointmentCard = memo(function AppointmentCard({
  item,
  isCancelling,
  onCancel,
}: {
  item: UserAppointment;
  isCancelling: boolean;
  onCancel: (item: UserAppointment) => void;
}) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const isInProgress = item.status === 'in_progress';
  const rules = getAppointmentRules(item);

  return (
    <View style={[styles.card, isInProgress && styles.cardInProgress]}>
      <View style={styles.cardTop}>
        <View style={[styles.statusPill, isInProgress && styles.statusPillActive]}>
          {isInProgress && <LiveDot size={9} />}
          <Text style={[styles.statusText, isInProgress && styles.statusTextActive]}>
            {isInProgress ? 'Em andamento' : 'Agendado'}
          </Text>
        </View>

        <View style={styles.timeWrap}>
          <Text style={styles.time}>{getTime(item.startAtMs)}</Text>
          <Text style={styles.dateLabel}>{getDateLabel(item.startAtMs)}</Text>
        </View>
      </View>

      <Text style={styles.serviceName} numberOfLines={1}>
        {item.serviceLabel ?? 'Serviço'}
      </Text>
      <Text style={styles.serviceMeta} numberOfLines={1}>
        {getVehicleLabel(item)} · {getDuration(item)}
      </Text>

      <View style={styles.cardDivider} />

      <View style={styles.cardBottom}>
        <Text style={styles.price}>{getPrice(item.price)}</Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.cancelButton,
              (!rules.canCancel || isCancelling) && styles.disabled,
            ]}
            onPress={() => onCancel(item)}
            disabled={!rules.canCancel || isCancelling}
            activeOpacity={0.75}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color={D.accent} />
            ) : (
              <Text style={styles.cancelText}>Cancelar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

function createStyles(D: AppColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: D.bg,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    header: {
      minHeight: 96,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 24,
      borderBottomWidth: 1,
      borderBottomColor: D.border,
    },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: D.card,
      borderWidth: 1.5,
      borderColor: D.borderStrong,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    headerTitle: {
      color: D.ink,
      fontSize: T.size.titleLarge,
      lineHeight: T.lineHeight.titleLarge,
      fontFamily: T.family.extraBold,
    },
    headerMeta: {
      color: D.ink3,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      marginTop: 2,
      fontFamily: T.family.semiBold,
    },

    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 18,
    },
    flexFill: {
      flex: 1,
    },
    listContent: {
      paddingBottom: 40,
    },
    separator: {
      height: 20,
    },
    card: {
      minHeight: 188,
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 20,
      backgroundColor: D.card,
      borderWidth: 1.5,
      borderColor: D.borderStrong,
    },
    cardInProgress: {
      borderLeftWidth: 4,
      borderLeftColor: D.primary,
    },
    cardTop: {
      minHeight: 40,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    statusPill: {
      minHeight: 30,
      borderRadius: 15,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      borderWidth: 1.5,
      borderColor: D.borderStrong,
      backgroundColor: D.surface,
    },
    statusPillActive: {
      borderColor: D.primary,
      backgroundColor: D.primaryLight,
    },
    statusDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: D.primary,
    },
    statusText: {
      color: D.ink3,
      fontSize: T.size.caption,
      lineHeight: T.lineHeight.caption,
      fontFamily: T.family.semiBold,
    },
    statusTextActive: {
      color: D.primary,
    },
    timeWrap: {
      alignItems: 'flex-end',
      marginTop: -3,
    },
    time: {
      color: D.primary,
      fontSize: T.size.titleLarge,
      lineHeight: T.lineHeight.titleLarge,
      fontFamily: T.family.extraBold,
    },
    dateLabel: {
      color: D.ink3,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      fontFamily: T.family.medium,
    },
    serviceName: {
      color: D.ink,
      fontSize: T.size.bodyLarge,
      lineHeight: T.lineHeight.bodyLarge,
      fontFamily: T.family.extraBold,
    },
    serviceMeta: {
      color: D.ink2,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      fontFamily: T.family.bold,
    },
    cardDivider: {
      height: 1,
      marginTop: 18,
      marginBottom: 16,
      borderStyle: 'dashed',
      borderWidth: 1,
      borderColor: D.border,
    },
    cardBottom: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    price: {
      color: D.ink2,
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      fontFamily: T.family.bold,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    actionButton: {
      minWidth: 118,
      minHeight: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: D.borderStrong,
    },
    cancelButton: {
      borderColor: D.accent,
      backgroundColor: D.surface,
    },
    cancelText: {
      color: D.accent,
      fontSize: T.size.secondary,
      fontFamily: T.family.bold,
    },
    disabled: {
      opacity: 0.48,
    },

    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 72,
      paddingHorizontal: 24,
    },
    emptyStateTitle: {
      color: D.ink,
      fontSize: T.size.title,
      lineHeight: T.lineHeight.title,
      fontFamily: T.family.extraBold,
      marginBottom: 8,
    },
    emptyStateText: {
      color: D.ink3,
      fontFamily: T.family.regular,
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      textAlign: 'center',
      marginBottom: 24,
    },
    emptyStateButton: {
      minHeight: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      backgroundColor: D.primary,
    },
    emptyStateButtonText: {
      color: D.onPrimary,
      fontSize: T.size.body,
      fontFamily: T.family.bold,
    },
  });
}
