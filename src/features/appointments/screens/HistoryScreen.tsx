import React, { memo, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
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
import { typography as T, useAppTheme, type AppColors } from '@shared/theme';
import { useNowTick } from '@shared/hooks/useNowTick';
import { HISTORY_APPOINTMENT_SET } from '../domain/appointment.constants';
import { isExpiredScheduled } from '../domain/appointment.helpers';
import type { UserAppointment } from '../domain/appointment.types';
import { useUserAppointments } from '../hooks/useUserAppointments';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type FilterId = 'all' | 'done' | 'cancelled' | 'no_show';

type HistoryGroup = {
  key: string;
  label: string;
  items: UserAppointment[];
};

const FILTER_OPTIONS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'done', label: 'Concluídos' },
  { id: 'cancelled', label: 'Cancelados' },
  { id: 'no_show', label: 'Não realizados' },
];

function isMissed(item: UserAppointment, now: number = Date.now()) {
  // Não realizado = o estabelecimento marcou no_show, OU o horário passou
  // (+ tolerância) e ainda está scheduled (vencido, aguardando baixa do dono).
  return item.status === 'no_show' || isExpiredScheduled(item.status, item.startAtMs, now);
}

function getFilteredItems(items: UserAppointment[], filter: FilterId, now: number) {
  if (filter === 'done') return items.filter(item => item.status === 'done');
  if (filter === 'cancelled') return items.filter(item => item.status === 'cancelled');
  if (filter === 'no_show') return items.filter(item => isMissed(item, now));
  return items;
}

function getMonthLabel(timestamp: number) {
  const date = new Date(timestamp);
  const month = date
    .toLocaleDateString('pt-BR', { month: 'long' })
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getFullYear()}`;
}

function getMonthKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getDay(timestamp: number) {
  return String(new Date(timestamp).getDate()).padStart(2, '0');
}

function getDuration(item: UserAppointment) {
  if (item.durationMin) return `${item.durationMin}min`;
  if (item.endAtMs) return `${Math.max(1, Math.round((item.endAtMs - item.startAtMs) / 60000))}min`;
  return '--';
}

function getVehicleLabel(item: UserAppointment) {
  if (item.vehicleType === 'Carro') return item.carCategory ?? 'Carro';
  return item.vehicleType;
}

function getStatusLabel(item: UserAppointment) {
  if (item.status === 'done') return 'Concluído';
  if (isMissed(item)) return 'Não realizado';
  return 'Cancelado';
}

function getCompactCurrency(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

function getRowCurrency(value: number | null) {
  if (value === null || value === undefined) return '--';
  return `R$${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

function groupByMonth(items: UserAppointment[]) {
  const groups = new Map<string, HistoryGroup>();

  items.forEach(item => {
    const key = getMonthKey(item.startAtMs);
    const current = groups.get(key);

    if (current) {
      current.items.push(item);
      return;
    }

    groups.set(key, {
      key,
      label: getMonthLabel(item.startAtMs),
      items: [item],
    });
  });

  return Array.from(groups.values());
}

export default function HistoryScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors: D, isLight } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const auth = getAuth();
  const uid = auth.currentUser?.uid;
  const [filter, setFilter] = useState<FilterId>('all');
  const now = useNowTick();

  const { loading, items } = useUserAppointments({
    uid,
    limitN: 50,
  });

  // Inclui no histórico os vencidos (scheduled que passaram do horário + tolerância):
  // pro cliente já são "Não realizado", mesmo antes do estabelecimento dar baixa.
  const historyItems = useMemo(
    () =>
      items.filter(
        item =>
          (HISTORY_APPOINTMENT_SET as readonly string[]).includes(item.status) ||
          isMissed(item, now),
      ),
    [items, now],
  );

  const filteredItems = useMemo(
    () => getFilteredItems(historyItems, filter, now),
    [filter, historyItems, now],
  );
  const groups = useMemo(() => groupByMonth(filteredItems), [filteredItems]);

  const totalDone = historyItems.filter(item => item.status === 'done').length;
  const totalSpent = historyItems
    .filter(item => item.status === 'done')
    .reduce((acc, item) => acc + (item.price ?? 0), 0);

  if (!uid) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />
        <View style={styles.centered}>
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
            <Text style={styles.headerTitle}>Histórico</Text>
            <Text style={styles.headerMeta} numberOfLines={1}>
              {totalDone} serviços · {getCompactCurrency(totalSpent)} investidos
            </Text>
          </View>
        </View>

        <View style={styles.filtersWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            {FILTER_OPTIONS.map(option => {
              const active = filter === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                  onPress={() => setFilter(option.id)}
                  activeOpacity={0.78}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={D.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {groups.length > 0 ? (
              groups.map(group => (
                <View key={group.key} style={styles.monthGroup}>
                  <Text style={styles.monthLabel}>{group.label}</Text>
                  {group.items.map((item, index) => (
                    <HistoryRow key={item.id} item={item} last={index === group.items.length - 1} />
                  ))}
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Nenhum registro</Text>
                <Text style={styles.emptyText}>
                  {filter === 'all'
                    ? 'Seus serviços finalizados aparecerão aqui.'
                    : 'Nenhum registro para este filtro.'}
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const HistoryRow = memo(function HistoryRow({
  item,
  last,
}: {
  item: UserAppointment;
  last: boolean;
}) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const isDone = item.status === 'done';
  const missed = isMissed(item);
  const price = getRowCurrency(item.price);

  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.day}>{getDay(item.startAtMs)}</Text>

      <View style={styles.rowBody}>
        <Text style={styles.serviceName} numberOfLines={1}>
          {item.serviceLabel ?? 'Serviço'}
        </Text>
        <Text style={styles.serviceMeta} numberOfLines={1}>
          {getVehicleLabel(item)} · {getDuration(item)}
        </Text>
      </View>

      <View style={styles.priceWrap}>
        <Text style={[styles.price, !isDone && styles.priceMuted]} numberOfLines={1}>
          {price}
        </Text>
        <Text
          style={[
            styles.status,
            isDone && styles.statusDone,
            missed && styles.statusNoShow,
            item.status === 'cancelled' && styles.statusCancelled,
          ]}
        >
          {getStatusLabel(item)}
        </Text>
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
    centered: {
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

    filtersWrap: {
      paddingVertical: 9,
    },
    filtersContent: {
      gap: 8,
      paddingHorizontal: 20,
    },
    filterPill: {
      minHeight: 28,
      minWidth: 62,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: D.border,
      backgroundColor: 'transparent',
    },
    filterPillActive: {
      backgroundColor: D.primary,
      borderColor: D.primary,
    },
    filterText: {
      color: D.ink2,
      fontSize: T.size.secondary,
      fontFamily: T.family.semiBold,
    },
    filterTextActive: {
      color: D.onPrimary,
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 11,
      paddingBottom: 42,
    },
    monthGroup: {
      marginBottom: 24,
    },
    monthLabel: {
      color: D.ink2,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      fontFamily: T.family.bold,
      marginBottom: 20,
    },
    row: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingBottom: 16,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: D.border,
      marginBottom: 18,
    },
    day: {
      width: 44,
      color: D.ink2,
      fontSize: T.size.titleLarge,
      lineHeight: T.lineHeight.titleLarge,
      fontFamily: T.family.extraBold,
    },
    rowBody: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
    },
    serviceName: {
      color: D.ink,
      fontSize: T.size.bodyLarge,
      lineHeight: T.lineHeight.bodyLarge,
      fontFamily: T.family.extraBold,
    },
    serviceMeta: {
      color: D.ink3,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      marginTop: 1,
      fontFamily: T.family.medium,
    },
    priceWrap: {
      width: 88,
      alignItems: 'flex-end',
      paddingTop: 2,
    },
    price: {
      color: D.primary,
      fontSize: T.size.bodyLarge,
      lineHeight: T.lineHeight.bodyLarge,
      fontFamily: T.family.extraBold,
    },
    priceMuted: {
      color: D.ink3,
    },
    status: {
      fontSize: T.size.caption,
      lineHeight: T.lineHeight.caption,
      marginTop: 2,
      fontFamily: T.family.bold,
      textAlign: 'right',
    },
    statusDone: {
      color: D.ink3,
    },
    statusNoShow: {
      color: D.accent,
    },
    statusCancelled: {
      color: D.ink3,
    },

    emptyState: {
      alignItems: 'center',
      paddingTop: 88,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      color: D.ink,
      fontSize: T.size.titleLarge,
      fontFamily: T.family.extraBold,
      marginBottom: 8,
    },
    emptyText: {
      color: D.ink3,
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      textAlign: 'center',
      fontFamily: T.family.medium,
    },
  });
}
