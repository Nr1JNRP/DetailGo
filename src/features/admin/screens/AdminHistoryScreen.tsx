import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';

import {
  collection,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

import { typography as T, useAppTheme, type AppColors } from '@shared/theme';
import { useCustomerName } from '@shared/hooks/useFirestoreCache';
import { useShop } from '@features/shops';
import { getAuth } from '@react-native-firebase/auth';

import type { AppointmentStatus } from '@features/appointments';
import type { AdminAppointment } from '../domain/adminAppointment.types';
import { normalizeAdminAppointmentFromGlobal } from '../data/adminAppointment.normalizers';

type QDoc = FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>;

interface FirebaseError extends Error {
  code?: string;
}

const ALL_HISTORY_STATUSES: AppointmentStatus[] = ['done', 'no_show', 'cancelled'];
type FilterId = 'all' | 'done' | 'no_show' | 'cancelled';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'TODOS' },
  { id: 'done', label: 'CONCLUÍDOS' },
  { id: 'no_show', label: 'NÃO REALIZADOS' },
  { id: 'cancelled', label: 'CANCELADOS' },
];

const PAGE_SIZE = 30;
const db = getFirestore();

const MONTHS_PT = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
];

function monthLabel(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`;
}

type AdminHistorySection = { title: string; data: AdminAppointment[] };

function groupByMonth(items: AdminAppointment[]): AdminHistorySection[] {
  const groups: Record<string, AdminHistorySection> = {};
  items.forEach(item => {
    const key = monthLabel(item.startAtMs);
    if (!groups[key]) groups[key] = { title: key, data: [] };
    groups[key].data.push(item);
  });
  return Object.values(groups);
}

function formatRevenue(value: number): string {
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
}

export default function AdminHistoryScreen() {
  const { colors: D, isLight } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const navigation = useNavigation();
  const auth = getAuth();
  const user = auth.currentUser;
  const { shopId } = useShop();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AdminAppointment[]>([]);
  const [filter, setFilter] = useState<FilterId>('all');
  const [loadingMore, setLoadingMore] = useState(false);
  const [totals, setTotals] = useState({ done: 0, revenue: 0 });

  const lastDocRef = useRef<QDoc | null>(null);
  const canLoadMoreRef = useRef(true);
  const { fetchCustomerName } = useCustomerName();

  const statusSet = useMemo((): AppointmentStatus[] => {
    if (filter === 'done') return ['done'];
    if (filter === 'no_show') return ['no_show'];
    if (filter === 'cancelled') return ['cancelled'];
    return ALL_HISTORY_STATUSES;
  }, [filter]);

  useEffect(() => {
    const doneItems = items.filter(i => i.status === 'done');
    setTotals({
      done: doneItems.length,
      revenue: doneItems.reduce((acc, i) => acc + (i.price ?? 0), 0),
    });
  }, [items]);

  const enrichWithNames = useCallback(
    async (list: AdminAppointment[]): Promise<AdminAppointment[]> =>
      Promise.all(
        list.map(async it => {
          if (it.customerName && it.customerName !== 'Cliente') return it;
          const name = await fetchCustomerName(it.customerUid);
          return { ...it, customerName: name };
        }),
      ),
    [fetchCustomerName],
  );

  useEffect(() => {
    if (!user?.uid || !shopId) return;

    setLoading(true);
    setItems([]);
    lastDocRef.current = null;
    canLoadMoreRef.current = true;

    const qy = query(
      collection(db, 'shops', shopId, 'appointments'),
      where('status', 'in', statusSet),
      orderBy('startAtMs', 'desc'),
      limit(PAGE_SIZE),
    );

    const unsub = onSnapshot(
      qy,
      async snap => {
        const base = snap.docs
          .map((d: QDoc) => normalizeAdminAppointmentFromGlobal(d))
          .filter(Boolean) as AdminAppointment[];

        lastDocRef.current = (snap.docs[snap.docs.length - 1] as QDoc | undefined) ?? null;
        canLoadMoreRef.current = snap.docs.length >= PAGE_SIZE;

        const withNames = await enrichWithNames(base);
        setItems(withNames);
        setLoading(false);
      },
      (error: FirebaseError) => {
        if (error.code === 'failed-precondition') {
          Alert.alert('Índice necessário', 'Crie um índice composto no Firebase Console.');
        } else {
          Alert.alert('Erro', 'Falha ao carregar histórico.');
        }
        setLoading(false);
      },
    );

    return () => unsub();
  }, [user?.uid, shopId, statusSet, enrichWithNames]);

  const loadMore = async () => {
    if (loadingMore || !canLoadMoreRef.current || !lastDocRef.current || !shopId) return;
    setLoadingMore(true);
    try {
      const qy = query(
        collection(db, 'shops', shopId, 'appointments'),
        where('status', 'in', statusSet),
        orderBy('startAtMs', 'desc'),
        startAfter(lastDocRef.current),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(qy);
      const base = snap.docs
        .map((d: QDoc) => normalizeAdminAppointmentFromGlobal(d))
        .filter(Boolean) as AdminAppointment[];

      lastDocRef.current =
        (snap.docs[snap.docs.length - 1] as QDoc | undefined) ?? lastDocRef.current;
      canLoadMoreRef.current = snap.docs.length >= PAGE_SIZE;

      const withNames = await enrichWithNames(base);
      setItems(prev => [...prev, ...withNames]);
    } catch {
      Alert.alert('Erro', 'Falha ao carregar mais itens.');
    } finally {
      setLoadingMore(false);
    }
  };

  const displayItems = useMemo(
    () => (filter === 'all' ? items : items.filter(i => i.status === filter)),
    [items, filter],
  );
  const sections = useMemo(() => groupByMonth(displayItems), [displayItems]);

  const renderHistoryItem = useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: AdminAppointment;
      index: number;
      section: AdminHistorySection;
    }) => <HistoryRow item={item} isLast={index === section.data.length - 1} />,
    [],
  );
  const renderSectionHeader = useCallback(
    ({ section }: { section: AdminHistorySection }) => (
      <Text style={styles.monthLabel}>{section.title}</Text>
    ),
    [styles],
  );

  return (
    <>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color={D.ink} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Histórico</Text>
            {totals.done > 0 && (
              <Text style={styles.headerSub}>
                {totals.done} concluídos · {formatRevenue(totals.revenue)}
              </Text>
            )}
          </View>
        </View>

        {/* ── Filter pills ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
          style={styles.filtersScroll}
        >
          {FILTERS.map(f => {
            const active = filter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => setFilter(f.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Lista ── */}
        {loading && displayItems.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator color={D.primary} size="large" />
          </View>
        ) : displayItems.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Nenhum registro encontrado.</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            renderSectionHeader={renderSectionHeader}
            renderItem={renderHistoryItem}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color={D.primary} />
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </>
  );
}

// ── Row component ────────────────────────────────────────────
const HistoryRow = memo(function HistoryRow({
  item,
  isLast,
}: {
  item: AdminAppointment;
  isLast: boolean;
}) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const d = new Date(item.startAtMs);
  const day = String(d.getDate()).padStart(2, '0');
  const hour = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
    2,
    '0',
  )}`;

  const isDone = item.status === 'done';
  const isNoShow = item.status === 'no_show';
  const isCancelled = item.status === 'cancelled';

  const customerShort = item.customerName
    ? item.customerName.split(' ').slice(0, 2).join(' ')
    : 'Cliente';

  const vehicleLabel = item.carCategory ?? item.vehicleType ?? '';

  return (
    <View>
      <View style={styles.row}>
        {/* Dia + hora */}
        <View style={styles.rowDate}>
          <Text style={styles.rowDay}>{day}</Text>
          <Text style={styles.rowHour}>{hour}</Text>
        </View>

        {/* Serviço + cliente */}
        <View style={styles.rowInfo}>
          <Text style={styles.rowService} numberOfLines={1}>
            {item.serviceLabel ?? 'Serviço'}
          </Text>
          <Text style={styles.rowCustomer} numberOfLines={1}>
            {customerShort}
            {vehicleLabel ? ` · ${vehicleLabel}` : ''}
          </Text>
        </View>

        {/* Preço / status */}
        <View style={styles.rowRight}>
          {isDone && <Text style={styles.rowPrice}>R$ {item.price ?? 0}</Text>}
          {isNoShow && (
            <>
              <Text style={styles.rowNoShowDash}>–</Text>
              <Text style={styles.rowNoShowLabel}>NÃO REALIZADO</Text>
            </>
          )}
          {isCancelled && <Text style={styles.rowCancelled}>CANCELADO</Text>}
        </View>
      </View>

      {/* Separador tracejado */}
      {!isLast && <View style={styles.separator} />}
    </View>
  );
});

// ── Styles ───────────────────────────────────────────────────
function createStyles(D: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: D.bg },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 14,
      gap: 14,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: D.card,
      borderWidth: 1,
      borderColor: D.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    headerText: { flex: 1 },
    headerTitle: {
      fontSize: 26,
      fontFamily: T.family.extraBold,
      color: D.ink,
      letterSpacing: -0.5,
    },
    headerSub: {
      fontSize: 13,
      color: D.ink3,
      marginTop: 2,
      fontFamily: T.family.medium,
    },

    // Filters
    filtersScroll: { maxHeight: 44, marginBottom: 16 },
    filtersRow: {
      paddingHorizontal: 20,
      gap: 8,
      alignItems: 'center',
    },
    pill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: D.border,
      backgroundColor: 'transparent',
    },
    pillActive: {
      backgroundColor: D.primary,
      borderColor: D.primary,
    },
    pillText: {
      fontSize: 11,
      fontFamily: T.family.bold,
      color: D.ink3,
      letterSpacing: 0.5,
    },
    pillTextActive: {
      color: '#0B0D0E',
    },

    // List
    listContent: { paddingHorizontal: 20, paddingBottom: 32 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontSize: 14, fontFamily: T.family.regular, color: D.ink3 },
    loadingMore: { paddingVertical: 20, alignItems: 'center' },

    // Month group header
    monthLabel: {
      fontSize: 11,
      fontFamily: T.family.bold,
      color: D.ink3,
      letterSpacing: 0.8,
      marginTop: 24,
      marginBottom: 8,
    },

    // Row
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 14,
      gap: 16,
    },
    rowDate: {
      width: 42,
      alignItems: 'flex-start',
    },
    rowDay: {
      fontSize: 26,
      fontFamily: T.family.extraBold,
      color: D.ink,
      letterSpacing: -1,
      lineHeight: 28,
    },
    rowHour: {
      fontSize: 11,
      fontFamily: T.family.medium,
      color: D.ink3,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    rowInfo: {
      flex: 1,
      paddingTop: 2,
    },
    rowService: {
      fontSize: 15,
      fontFamily: T.family.bold,
      color: D.ink,
      marginBottom: 3,
    },
    rowCustomer: {
      fontSize: 12,
      color: D.ink3,
      fontFamily: T.family.medium,
    },
    rowRight: {
      alignItems: 'flex-end',
      justifyContent: 'flex-start',
      paddingTop: 4,
      minWidth: 80,
    },
    rowPrice: {
      fontSize: 15,
      fontFamily: T.family.extraBold,
      color: D.primary,
      letterSpacing: -0.3,
    },
    rowNoShowDash: {
      fontSize: 15,
      fontFamily: T.family.extraBold,
      color: D.accent,
    },
    rowNoShowLabel: {
      fontSize: 9,
      fontFamily: T.family.bold,
      color: D.accent,
      letterSpacing: 0.3,
      marginTop: 2,
    },
    rowCancelled: {
      fontSize: 9,
      fontFamily: T.family.bold,
      color: D.ink3,
      letterSpacing: 0.3,
      marginTop: 6,
    },

    // Dashed separator
    separator: {
      height: 1,
      borderStyle: 'dashed',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
  });
}
