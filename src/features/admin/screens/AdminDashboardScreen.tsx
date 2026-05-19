import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { launchImageLibrary, type ImageLibraryOptions } from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from '@react-native-firebase/auth';
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { Bell, ChevronLeft, ChevronRight, Menu } from 'lucide-react-native';
import AdminDrawer from '../components/AdminDrawer';

import { darkColors, spacing, radii } from '@shared/theme';
import { UI } from '@shared/constants/app.constants';
import { dateUtils } from '@shared/utils/date.utils';
import { formatUtils } from '@shared/utils/format.utils';
import { useCustomerName } from '@shared/hooks/useFirestoreCache';

import { updateAppointmentStatus } from '@features/admin';
import { useShop } from '@features/shops';
import { NO_SHOW_GRACE_MS } from '@features/appointments';
import type { AppointmentStatus } from '@features/appointments';
import type { AdminAppointment } from '../domain/adminAppointment.types';
import { normalizeAdminAppointmentFromGlobal } from '../data/adminAppointment.normalizers';

type QDoc = FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>;

const WEEK_DAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

// Sunday-start week helpers (matches design: DOM → SAB)
function weekStartSun(anchor: Date): number {
  const d = new Date(anchor);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function weekEndSun(anchor: Date): number {
  const d = new Date(weekStartSun(anchor));
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function isSameWeekSun(a: Date, b: Date): boolean {
  return weekStartSun(a) === weekStartSun(b);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function AppointmentSeparator() {
  return <View style={{ height: spacing.sm }} />;
}

export default function AdminDashboardScreen() {
  const auth = getAuth();
  const user = auth.currentUser;
  const db = getFirestore();
  const { shopId } = useShop();

  const [appointmentsWeek, setAppointmentsWeek] = useState<AdminAppointment[]>([]);
  const [doneThisWeek, setDoneThisWeek] = useState<AdminAppointment[]>([]);
  const [donePrevWeekCount, setDonePrevWeekCount] = useState(0);
  const [loadingWeek, setLoadingWeek] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const noShowMarkedRef = useRef<Set<string>>(new Set());

  const [weekAnchor, setWeekAnchor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  // ── Perfil do proprietário ──
  const [ownerPhotoB64, setOwnerPhotoB64] = useState<string | null>(null);
  const ownerName = user?.displayName ?? 'Proprietário';
  const ownerInitials = ownerName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'BOM DIA';
    if (h < 18) return 'BOA TARDE';
    return 'BOA NOITE';
  })();

  // ── Drawer ──
  const [drawerVisible, setDrawerVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-UI.MENU_WIDTH)).current;

  const toggleDrawer = () => {
    if (drawerVisible) {
      Animated.timing(slideAnim, {
        toValue: -UI.MENU_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setDrawerVisible(false));
    } else {
      setDrawerVisible(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  };

  const weekStartMs = useMemo(() => weekStartSun(weekAnchor), [weekAnchor]);
  const weekEndMs = useMemo(() => weekEndSun(weekAnchor), [weekAnchor]);
  const isCurrentWeek = useMemo(() => isSameWeekSun(weekAnchor, new Date()), [weekAnchor]);

  const { fetchCustomerName } = useCustomerName();

  // Carrega foto do proprietário em tempo real
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), snap => {
      const data = snap.data() as { photoB64?: string } | undefined;
      setOwnerPhotoB64(data?.photoB64 ?? null);
    });
    return () => unsub();
  }, [user?.uid, db]);

  const saveAvatar = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: true,
        quality: 0.7,
        maxWidth: 500,
        maxHeight: 500,
      } as ImageLibraryOptions);
      if (res.didCancel) return;
      const asset = res.assets?.[0];
      if (!asset?.base64 || !user?.uid) return;
      const b64 = `data:${asset.type?.startsWith('image/') ? asset.type : 'image/jpeg'};base64,${
        asset.base64
      }`;
      const { setDoc } = await import('@react-native-firebase/firestore');
      await setDoc(doc(db, 'users', user.uid), { photoB64: b64 }, { merge: true });
      setOwnerPhotoB64(b64);
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar a foto');
    }
  };

  useEffect(() => {
    if (isCurrentWeek) {
      setSelectedDay(new Date());
    } else {
      setSelectedDay(new Date(weekStartMs));
    }
  }, [isCurrentWeek, weekStartMs]);

  const fillMissingNamesAndUpdate = useCallback(
    async (list: AdminAppointment[]) => {
      const updated: AdminAppointment[] = [];
      await Promise.all(
        list.map(async it => {
          if (it.customerName && it.customerName !== 'Cliente') {
            updated.push(it);
            return;
          }
          const name = await fetchCustomerName(it.customerUid);
          if (shopId) {
            try {
              await updateDoc(doc(db, 'shops', shopId, 'appointments', it.id), {
                customerName: name,
              });
            } catch {}
          }
          updated.push({ ...it, customerName: name });
        }),
      );
      return updated.sort((a, b) => a.startAtMs - b.startAtMs);
    },
    [db, fetchCustomerName, shopId],
  );

  // Active appointments (scheduled + in_progress) for the week → agenda list
  useEffect(() => {
    if (!user?.uid || !shopId) return;
    setLoadingWeek(true);

    const q = query(
      collection(db, 'shops', shopId, 'appointments'),
      where('status', 'in', ['scheduled', 'in_progress']),
      where('startAtMs', '>=', weekStartMs),
      where('startAtMs', '<=', weekEndMs),
      orderBy('startAtMs', 'asc'),
    );

    const unsub = onSnapshot(
      q,
      async snap => {
        const base = snap.docs
          .map((d: QDoc) => normalizeAdminAppointmentFromGlobal(d))
          .filter(Boolean) as AdminAppointment[];

        const now = Date.now();
        const expiredScheduled = base.filter(
          it =>
            it.status === 'scheduled' &&
            now > it.startAtMs + NO_SHOW_GRACE_MS &&
            !noShowMarkedRef.current.has(it.id),
        );

        if (expiredScheduled.length > 0) {
          await Promise.all(
            expiredScheduled.map(async it => {
              noShowMarkedRef.current.add(it.id);
              try {
                await updateAppointmentStatus({
                  shopId: shopId ?? '',
                  appointmentId: it.id,
                  customerUid: it.customerUid,
                  status: 'no_show',
                });
              } catch {
                noShowMarkedRef.current.delete(it.id);
              }
            }),
          );
        }

        const finalList = await fillMissingNamesAndUpdate(base);
        setAppointmentsWeek(finalList);
        setLoadingWeek(false);
      },
      () => setLoadingWeek(false),
    );

    return () => unsub();
  }, [db, user?.uid, shopId, weekStartMs, weekEndMs, fillMissingNamesAndUpdate]);

  // Done appointments for KPI stats
  useEffect(() => {
    if (!shopId) return;

    const q = query(
      collection(db, 'shops', shopId, 'appointments'),
      where('status', '==', 'done'),
      where('startAtMs', '>=', weekStartMs),
      where('startAtMs', '<=', weekEndMs),
      orderBy('startAtMs', 'asc'),
    );

    const unsub = onSnapshot(
      q,
      snap => {
        const list = snap.docs
          .map((d: QDoc) => normalizeAdminAppointmentFromGlobal(d))
          .filter(Boolean) as AdminAppointment[];
        setDoneThisWeek(list);
      },
      () => {},
    );

    return () => unsub();
  }, [db, shopId, weekStartMs, weekEndMs]);

  // Previous week done count for delta comparison
  useEffect(() => {
    if (!shopId) return;

    const ms7d = 7 * 24 * 60 * 60 * 1000;
    const prevStart = weekStartMs - ms7d;
    const prevEnd = weekEndMs - ms7d;

    const q = query(
      collection(db, 'shops', shopId, 'appointments'),
      where('status', '==', 'done'),
      where('startAtMs', '>=', prevStart),
      where('startAtMs', '<=', prevEnd),
      orderBy('startAtMs', 'asc'),
    );

    const unsub = onSnapshot(
      q,
      snap => setDonePrevWeekCount(snap.size),
      () => {},
    );

    return () => unsub();
  }, [db, shopId, weekStartMs, weekEndMs]);

  // KPI computations
  const weekServicesCount = doneThisWeek.length;
  const deltaVsPrev = weekServicesCount - donePrevWeekCount;
  const avgTicket = useMemo(() => {
    if (doneThisWeek.length === 0) return 0;
    return doneThisWeek.reduce((s, a) => s + (a.price ?? 0), 0) / doneThisWeek.length;
  }, [doneThisWeek]);

  // Appointments filtered to selected day
  const agendaList = useMemo(
    () => appointmentsWeek.filter(item => isSameDay(new Date(item.startAtMs), selectedDay)),
    [appointmentsWeek, selectedDay],
  );

  // Per-day appointment count for day strip
  const countPerDay = useMemo(() => {
    const sunDate = new Date(weekStartMs);
    return WEEK_DAYS.map((_, i) => {
      const dayDate = dateUtils.addDays(sunDate, i);
      return appointmentsWeek.filter(item => isSameDay(new Date(item.startAtMs), dayDate)).length;
    });
  }, [appointmentsWeek, weekStartMs]);

  if (!user?.uid) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color={darkColors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const weekStart = new Date(weekStartMs);
  const weekEnd = new Date(weekEndMs);
  const mStart = weekStart
    .toLocaleString('pt-BR', { month: 'short' })
    .replace('.', '')
    .toUpperCase();
  const mEnd = weekEnd.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
  const periodText =
    mStart === mEnd
      ? `${weekStart.getDate()} – ${weekEnd.getDate()} ${mStart}`
      : `${weekStart.getDate()} ${mStart} — ${weekEnd.getDate()} ${mEnd}`;

  const doUpdate = async (item: AdminAppointment, next: AppointmentStatus) => {
    if (updatingId || !shopId) return;
    setUpdatingId(item.id);
    try {
      await updateAppointmentStatus({
        shopId,
        appointmentId: item.id,
        customerUid: item.customerUid,
        status: next,
      });
    } catch (e: any) {
      Alert.alert(
        'Erro',
        e?.code === 'APPOINTMENT_EXPIRED' ? 'Agendamento expirado.' : 'Não foi possível atualizar.',
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const renderAppointment = ({ item }: { item: AdminAppointment }) => {
    const vehicle =
      item.vehicleType === 'Carro' && item.carCategory ? item.carCategory : item.vehicleType;

    const expired = dateUtils.isExpired(item.startAtMs, NO_SHOW_GRACE_MS);
    const isInProgress = item.status === 'in_progress';
    const isActive = isInProgress && !expired;
    const durationMin = item.endAtMs ? Math.round((item.endAtMs - item.startAtMs) / 60000) : null;

    const onPress = () => {
      if (expired && item.status === 'scheduled') {
        Alert.alert(
          'Serviço não realizado',
          'Já passaram 15 minutos do horário. Agendamento considerado NÃO REALIZADO.',
        );
        return;
      }
      if (item.status === 'scheduled') doUpdate(item, 'in_progress');
      else if (item.status === 'in_progress') doUpdate(item, 'done');
    };

    return (
      <View style={styles.agendaRow}>
        <View style={styles.agendaTimeCol}>
          <Text style={styles.agendaHour}>{dateUtils.formatHour(item.startAtMs)}</Text>
          {durationMin !== null && <Text style={styles.agendaDuration}>{durationMin}m</Text>}
        </View>

        <TouchableOpacity
          style={[styles.agendaCard, isActive && styles.agendaCardActive]}
          onPress={onPress}
          activeOpacity={0.75}
          disabled={!!updatingId}
        >
          <View style={styles.agendaCardContent}>
            <Text style={styles.agendaService} numberOfLines={1}>
              {item.serviceLabel ?? 'Serviço'}
            </Text>
            <Text style={styles.agendaClient} numberOfLines={1}>
              {item.customerName} · {vehicle}
            </Text>
          </View>

          {updatingId === item.id ? (
            <ActivityIndicator size="small" color={darkColors.primary} />
          ) : (
            isActive && <View style={styles.agendaDot} />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const ListHeader = (
    <>
      {/* ── Topbar ─────────────────────────────── */}
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.headerBtn} onPress={toggleDrawer} activeOpacity={0.7}>
          <Menu size={20} color={darkColors.ink2} />
        </TouchableOpacity>
        <Text style={styles.topbarBrand}>DETAILGO</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => Alert.alert('Notificações', 'Em breve!')}
          activeOpacity={0.7}
        >
          <Bell size={20} color={darkColors.ink2} />
          <View style={styles.bellDot} />
        </TouchableOpacity>
      </View>

      {/* ── Perfil — igual ao cliente ───────────── */}
      <View style={styles.profileRow}>
        <TouchableOpacity onPress={saveAvatar} activeOpacity={0.85}>
          {ownerPhotoB64 ? (
            <Image source={{ uri: ownerPhotoB64 }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{ownerInitials}</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.profileInfo}>
          <Text style={styles.greetingText}>{greeting}</Text>
          <Text style={styles.ownerName}>{ownerName}</Text>
        </View>
        <Text style={styles.profileRole}>Proprietário</Text>
      </View>

      {/* ── KPI Cards ──────────────────────────── */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { flex: 1.1 }]}>
          <Text style={styles.kpiLabel}>SERVIÇOS · SEMANA</Text>
          <View style={styles.kpiValueRow}>
            <Text style={styles.kpiNumber}>{weekServicesCount}</Text>
            <Text style={styles.kpiUnit}> realizados</Text>
          </View>
          {deltaVsPrev !== 0 && (
            <Text
              style={[
                styles.kpiDelta,
                { color: deltaVsPrev > 0 ? darkColors.primary : darkColors.status.error },
              ]}
            >
              {deltaVsPrev > 0 ? '▲' : '▼'} {deltaVsPrev > 0 ? '+' : ''}
              {deltaVsPrev} vs semana passada
            </Text>
          )}
        </View>

        <View style={[styles.kpiCard, { flex: 1 }]}>
          <Text style={styles.kpiLabel}>TICKET MÉDIO</Text>
          <Text style={styles.kpiAvg}>{formatUtils.currency(avgTicket)}</Text>
          <Text style={styles.kpiSub}>últimos 7 dias</Text>
        </View>
      </View>

      {/* ── Week Strip ─────────────────────────── */}
      <View style={styles.weekStrip}>
        <View style={styles.weekNav}>
          <Text style={styles.weekPeriod}>{periodText}</Text>
          <View style={styles.weekNavBtns}>
            <TouchableOpacity
              style={styles.weekNavBtn}
              onPress={() => setWeekAnchor(prev => dateUtils.addDays(prev, -7))}
              activeOpacity={0.7}
            >
              <ChevronLeft size={16} color={darkColors.ink2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.weekNavBtn}
              onPress={() => setWeekAnchor(prev => dateUtils.addDays(prev, 7))}
              activeOpacity={0.7}
            >
              <ChevronRight size={16} color={darkColors.ink2} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.weekDays}>
          {WEEK_DAYS.map((day, i) => {
            const dayDate = dateUtils.addDays(weekStart, i);
            const isSelected = isSameDay(dayDate, selectedDay);
            const count = countPerDay[i];

            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                onPress={() => setSelectedDay(new Date(dayDate))}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayName, isSelected && styles.dayTextSelected]}>{day}</Text>
                <Text style={[styles.dayNumber, isSelected && styles.dayTextSelected]}>
                  {dayDate.getDate()}
                </Text>
                <Text
                  style={[
                    styles.dayCount,
                    isSelected && styles.dayCountSelected,
                    count === 0 && styles.dayCountZero,
                  ]}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Section label ──────────────────────── */}
      <Text style={styles.sectionLabel}>AGENDA · DA SEMANA</Text>
    </>
  );

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={darkColors.bg} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <FlatList
          data={agendaList}
          keyExtractor={item => item.id}
          renderItem={renderAppointment}
          ItemSeparatorComponent={AppointmentSeparator}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            loadingWeek ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={darkColors.primary} />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Sem agendamentos</Text>
                <Text style={styles.emptyText}>Nenhum serviço para este dia.</Text>
              </View>
            )
          }
        />
      </SafeAreaView>

      {/* ── Drawer lateral — igual ao cliente ── */}
      <AdminDrawer visible={drawerVisible} slideAnim={slideAnim} onClose={toggleDrawer} />
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: darkColors.bg,
  },
  listContent: {
    paddingBottom: 40,
  },

  // ── Header ──────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: darkColors.ink3,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: darkColors.ink,
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: darkColors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: darkColors.border,
  },

  // ── KPI Cards ────────────────────────────────────
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  kpiCard: {
    backgroundColor: darkColors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: darkColors.border,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: darkColors.ink3,
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  kpiValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  kpiNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: darkColors.ink,
    lineHeight: 36,
  },
  kpiUnit: {
    fontSize: 13,
    fontWeight: '500',
    color: darkColors.ink2,
    marginBottom: 4,
  },
  kpiDelta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  kpiAvg: {
    fontSize: 26,
    fontWeight: '800',
    color: darkColors.ink,
    lineHeight: 32,
    marginBottom: 2,
  },
  kpiSub: {
    fontSize: 11,
    color: darkColors.ink3,
    fontWeight: '500',
  },

  // ── Week Strip ───────────────────────────────────
  weekStrip: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  weekNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  weekPeriod: {
    fontSize: 13,
    fontWeight: '600',
    color: darkColors.ink2,
    letterSpacing: 0.2,
  },
  weekNavBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  weekNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: darkColors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: darkColors.border,
  },
  weekDays: {
    flexDirection: 'row',
    gap: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: darkColors.card,
    borderWidth: 1,
    borderColor: darkColors.border,
  },
  dayCellSelected: {
    backgroundColor: darkColors.primary,
    borderColor: darkColors.primary,
  },
  dayName: {
    fontSize: 9,
    fontWeight: '700',
    color: darkColors.ink3,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: darkColors.ink,
    marginBottom: 2,
  },
  dayTextSelected: {
    color: darkColors.onPrimary,
  },
  dayCount: {
    fontSize: 11,
    fontWeight: '600',
    color: darkColors.primary,
  },
  dayCountSelected: {
    color: darkColors.onPrimary,
  },
  dayCountZero: {
    color: darkColors.ink3,
  },

  // ── Section label ────────────────────────────────
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: darkColors.ink3,
    letterSpacing: 0.8,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },

  // ── Agenda rows ──────────────────────────────────
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  agendaTimeCol: {
    width: 48,
    alignItems: 'flex-start',
  },
  agendaHour: {
    fontSize: 15,
    fontWeight: '700',
    color: darkColors.ink,
    lineHeight: 18,
  },
  agendaDuration: {
    fontSize: 11,
    color: darkColors.ink3,
    fontWeight: '500',
    marginTop: 1,
  },
  agendaCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkColors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: darkColors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 68,
  },
  agendaCardActive: {
    borderColor: darkColors.primary,
  },
  agendaCardContent: {
    flex: 1,
  },
  agendaService: {
    fontSize: 16,
    fontWeight: '700',
    color: darkColors.ink,
    marginBottom: 3,
  },
  agendaClient: {
    fontSize: 13,
    color: darkColors.ink3,
    fontWeight: '400',
  },
  agendaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: darkColors.primary,
    marginLeft: spacing.sm,
  },

  // ── Loading / Empty ──────────────────────────────
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyState: {
    marginHorizontal: spacing.lg,
    paddingVertical: 40,
    alignItems: 'center',
    backgroundColor: darkColors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: darkColors.border,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: darkColors.ink2,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: darkColors.ink3,
  },

  // ── Topbar padronizado ──────────────────────────
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  topbarBrand: {
    fontSize: 13,
    fontWeight: '800',
    color: darkColors.ink,
    letterSpacing: 2,
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: darkColors.primary,
    borderWidth: 1.5,
    borderColor: darkColors.card,
  },

  // ── Perfil — igual ao cliente ───────────────────
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: darkColors.border,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: darkColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0B0D0E',
  },
  profileInfo: { flex: 1 },
  greetingText: {
    fontSize: 9,
    fontWeight: '700',
    color: darkColors.ink3,
    letterSpacing: 1,
    marginBottom: 2,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '800',
    color: darkColors.ink,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  shopBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: darkColors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(212,255,61,0.2)',
  },
  shopBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: darkColors.primary,
  },
  profileRole: {
    fontSize: 11,
    fontWeight: '600',
    color: darkColors.ink3,
  },
});
