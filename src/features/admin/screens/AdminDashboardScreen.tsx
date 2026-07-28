import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  getCountFromServer,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Menu,
  PlayCircle,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import AdminDrawer from '../components/AdminDrawer';

import { spacing, radii, typography as T, useAppTheme, type AppColors } from '@shared/theme';
import { UI } from '@shared/constants/app.constants';
import { dateUtils } from '@shared/utils/date.utils';
import { formatUtils } from '@shared/utils/format.utils';
import { useCustomerName } from '@shared/hooks/useFirestoreCache';
import { uploadProfilePhoto } from '@shared/services/userPhoto.service';
import PremiumStar from '@shared/components/PremiumStar';
import ConfirmModal from '@shared/components/ConfirmModal';
import SuccessModal from '@shared/components/SuccessModal';
import { useFeedback } from '@shared/components/FeedbackProvider';

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { updateAppointmentStatus } from '@features/admin';
import { useMeStore } from '@features/auth';
import { useShop } from '@features/shops';
import { useShopNotifications, useRegisterPushToken } from '@features/notifications';
import { NO_SHOW_GRACE_MS } from '@features/appointments';
import type { AppointmentStatus } from '@features/appointments';
import type { RootStackParamList } from '@app/types';
import type { AdminAppointment } from '../domain/adminAppointment.types';
import { normalizeAdminAppointmentFromGlobal } from '../data/adminAppointment.normalizers';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type QDoc = FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>;

type StatusConfirm = {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  item: AdminAppointment;
  next: AppointmentStatus;
};

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
  const { colors: D, isLight } = useAppTheme();
  const { showError } = useFeedback();
  const styles = useMemo(() => createStyles(D), [D]);
  const auth = getAuth();
  const user = auth.currentUser;
  const db = getFirestore();
  const { shopId, shop } = useShop();
  const isPremium = shop?.subscriptionStatus === 'active';
  const navigation = useNavigation<Nav>();
  const { unreadCount } = useShopNotifications(shopId);

  // Registra o token de push do owner (pede permissão na primeira vez).
  useRegisterPushToken(user?.uid);

  const [appointmentsWeek, setAppointmentsWeek] = useState<AdminAppointment[]>([]);
  const [doneThisWeek, setDoneThisWeek] = useState<AdminAppointment[]>([]);
  const [donePrevWeekCount, setDonePrevWeekCount] = useState(0);
  const [loadingWeek, setLoadingWeek] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<StatusConfirm | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const [weekAnchor, setWeekAnchor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  // ── Perfil do proprietário ──
  // Foto vem do listener único de users/{uid} (useMeStore). Prefere a URL do
  // Storage e cai pro base64 legado só como fallback.
  const ownerPhotoB64 = useMeStore(s => s.me?.photoURL ?? s.me?.photoB64 ?? null);
  const [savingOwnerPhoto, setSavingOwnerPhoto] = useState(false);
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

  const saveAvatar = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 0.7,
        maxWidth: 800,
        maxHeight: 800,
      } as ImageLibraryOptions);
      if (res.didCancel) return;
      const asset = res.assets?.[0];
      if (!asset?.uri || !user?.uid) return;
      setSavingOwnerPhoto(true);
      // Upload no Storage; o listener único de users/{uid} atualiza o store.
      const result = await uploadProfilePhoto(user.uid, asset.uri);
      if (!result.ok) {
        showError(result.message);
      }
    } catch {
      showError('Não foi possível atualizar a foto');
    } finally {
      setSavingOwnerPhoto(false);
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

  // Active appointments (scheduled + in_progress) for the week → agenda list.
  // useFocusEffect: só escuta enquanto a tela está em foco (desassina ao sair),
  // evitando leituras/re-render em segundo plano.
  useFocusEffect(
    useCallback(() => {
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

          // Agendamentos expirados ficam como "aguardando baixa" ate o owner dar
          // baixa manualmente (Nao realizado). Sem marcacao automatica.
          const finalList = await fillMissingNamesAndUpdate(base);
          setAppointmentsWeek(finalList);
          setLoadingWeek(false);
        },
        () => setLoadingWeek(false),
      );

      return () => unsub();
    }, [db, user?.uid, shopId, weekStartMs, weekEndMs, fillMissingNamesAndUpdate]),
  );

  // Done appointments for KPI stats (também pausado fora de foco)
  useFocusEffect(
    useCallback(() => {
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
    }, [db, shopId, weekStartMs, weekEndMs]),
  );

  // Contagem da semana anterior (para o delta). A semana passada não muda, então
  // usamos getCountFromServer (1 leitura) em vez de um onSnapshot que leria todos
  // os docs "done" daquela semana.
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
    );

    let cancelled = false;
    getCountFromServer(q)
      .then(snap => {
        if (!cancelled) setDonePrevWeekCount(snap.data().count);
      })
      .catch(() => {
        if (!cancelled) setDonePrevWeekCount(0);
      });

    return () => {
      cancelled = true;
    };
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
        <ActivityIndicator size="large" color={D.primary} style={{ flex: 1 }} />
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
        status: next,
      });

      const successMsg =
        next === 'no_show'
          ? 'Serviço marcado como não realizado.'
          : next === 'done'
          ? 'Serviço concluído.'
          : 'Atendimento iniciado.';
      setSuccessFeedback({
        title: 'Pronto',
        message: successMsg,
      });
    } catch (e: any) {
      showError(
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
    const isExpiredScheduled = item.status === 'scheduled' && expired;
    const isUpdating = updatingId === item.id;
    const durationMin = item.endAtMs ? Math.round((item.endAtMs - item.startAtMs) / 60000) : null;
    const statusLabel = isExpiredScheduled
      ? 'Aguardando baixa'
      : isInProgress
      ? 'Em atendimento'
      : 'Agendado';
    const actionLabel = isExpiredScheduled
      ? 'Não realizado'
      : isInProgress
      ? 'Concluir serviço'
      : 'Iniciar atendimento';

    const onActionPress = () => {
      if (isExpiredScheduled) {
        setStatusConfirm({
          title: 'Marcar n\u00e3o realizado',
          message:
            'Esse hor\u00e1rio j\u00e1 passou. Deseja dar baixa como servi\u00e7o n\u00e3o realizado?',
          confirmLabel: 'Marcar',
          destructive: true,
          item,
          next: 'no_show',
        });
        return;
      }

      if (item.status === 'scheduled') {
        doUpdate(item, 'in_progress');
        return;
      }

      if (item.status === 'in_progress') {
        setStatusConfirm({
          title: 'Concluir servi\u00e7o',
          message: `Finalizar ${item.serviceLabel ?? 'este servi\u00e7o'}?`,
          confirmLabel: 'Concluir',
          item,
          next: 'done',
        });
        return;
      }
    };

    return (
      <View style={styles.agendaRow}>
        <View style={styles.agendaTimeCol}>
          <Text style={styles.agendaHour}>{dateUtils.formatHour(item.startAtMs)}</Text>
          {durationMin !== null && <Text style={styles.agendaDuration}>{durationMin}m</Text>}
        </View>

        <View
          style={[
            styles.agendaCard,
            isInProgress && styles.agendaCardActive,
            isExpiredScheduled && styles.agendaCardExpired,
          ]}
        >
          <View style={styles.agendaCardHeader}>
            <Text style={styles.agendaService} numberOfLines={1}>
              {item.serviceLabel ?? 'Serviço'}
            </Text>
            <View
              style={[
                styles.agendaStatusPill,
                isInProgress && styles.agendaStatusPillActive,
                isExpiredScheduled && styles.agendaStatusPillExpired,
              ]}
            >
              <View
                style={[
                  styles.agendaStatusDot,
                  isInProgress && styles.agendaStatusDotActive,
                  isExpiredScheduled && styles.agendaStatusDotExpired,
                ]}
              />
              <Text
                style={[
                  styles.agendaStatusText,
                  isInProgress && styles.agendaStatusTextActive,
                  isExpiredScheduled && styles.agendaStatusTextExpired,
                ]}
                numberOfLines={1}
              >
                {statusLabel}
              </Text>
            </View>
          </View>

          <Text style={styles.agendaClient} numberOfLines={1}>
            {item.customerName} · {vehicle}
          </Text>

          <TouchableOpacity
            style={[
              styles.agendaActionButton,
              isInProgress && styles.agendaActionButtonDone,
              isExpiredScheduled && styles.agendaActionButtonExpired,
            ]}
            onPress={onActionPress}
            activeOpacity={0.78}
            disabled={!!updatingId}
          >
            {isUpdating ? (
              <ActivityIndicator
                size="small"
                color={isInProgress ? D.onPrimary : isExpiredScheduled ? D.status.error : D.primary}
              />
            ) : (
              <>
                {isExpiredScheduled ? (
                  <AlertTriangle size={16} color={D.status.error} />
                ) : isInProgress ? (
                  <CheckCircle2 size={16} color={D.onPrimary} />
                ) : (
                  <PlayCircle size={16} color={D.primary} />
                )}
                <Text
                  style={[
                    styles.agendaActionText,
                    isInProgress && styles.agendaActionTextDone,
                    isExpiredScheduled && styles.agendaActionTextExpired,
                  ]}
                  numberOfLines={1}
                >
                  {actionLabel}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const ListHeader = (
    <>
      {/* ── Topbar ─────────────────────────────── */}
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.headerBtn} onPress={toggleDrawer} activeOpacity={0.7}>
          <Menu size={20} color={D.ink2} />
        </TouchableOpacity>
        <Text style={styles.topbarBrand}>DETAILGO</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('AdminNotifications')}
          activeOpacity={0.7}
        >
          <Bell size={20} color={D.ink2} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Perfil — igual ao cliente ───────────── */}
      <View style={styles.profileRow}>
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={saveAvatar}
          activeOpacity={0.85}
          disabled={savingOwnerPhoto}
        >
          {ownerPhotoB64 ? (
            <Image source={{ uri: ownerPhotoB64 }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{ownerInitials}</Text>
            </View>
          )}
          <View style={styles.cameraBadge}>
            {savingOwnerPhoto ? (
              <ActivityIndicator color={D.primary} size="small" />
            ) : (
              <Camera size={12} color={D.primary} strokeWidth={2.4} />
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.profileInfo}>
          <Text style={styles.greetingText}>{greeting}</Text>
          <Text style={styles.ownerName}>{ownerName}</Text>
        </View>
        {isPremium ? (
          <View style={styles.premiumBadge}>
            <PremiumStar size={26} light={isLight} />
            <Text style={styles.premiumBadgeText}>Premium</Text>
          </View>
        ) : (
          <View style={styles.trialBadge}>
            <Clock size={12} color={D.primary} strokeWidth={2.5} />
            <Text style={styles.trialBadgeText}>Trial</Text>
          </View>
        )}
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
            <View style={styles.kpiDeltaRow}>
              {deltaVsPrev > 0 ? (
                <TrendingUp size={13} color={D.primary} strokeWidth={2.6} />
              ) : (
                <TrendingDown size={13} color={D.status.error} strokeWidth={2.6} />
              )}
              <Text
                style={[styles.kpiDelta, { color: deltaVsPrev > 0 ? D.primary : D.status.error }]}
              >
                {deltaVsPrev > 0 ? '+' : ''}
                {deltaVsPrev} vs semana passada
              </Text>
            </View>
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
              <ChevronLeft size={16} color={D.ink2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.weekNavBtn}
              onPress={() => setWeekAnchor(prev => dateUtils.addDays(prev, 7))}
              activeOpacity={0.7}
            >
              <ChevronRight size={16} color={D.ink2} />
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
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />
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
                <ActivityIndicator size="large" color={D.primary} />
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
      <ConfirmModal
        visible={!!statusConfirm}
        title={statusConfirm?.title ?? ''}
        message={statusConfirm?.message ?? ''}
        confirmLabel={statusConfirm?.confirmLabel ?? ''}
        destructive={statusConfirm?.destructive}
        onCancel={() => setStatusConfirm(null)}
        onConfirm={() => {
          const action = statusConfirm;
          setStatusConfirm(null);
          if (action) {
            doUpdate(action.item, action.next);
          }
        }}
      />
      <SuccessModal
        visible={!!successFeedback}
        title={successFeedback?.title ?? ''}
        message={successFeedback?.message ?? ''}
        primaryLabel="Ok"
        onPrimary={() => setSuccessFeedback(null)}
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
    listContent: {
      paddingBottom: spacing.lg,
    },

    // ── Header ──────────────────────────────────────
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    headerMeta: {
      fontSize: 11,
      fontFamily: T.family.semiBold,
      color: D.ink3,
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    headerTitle: {
      fontSize: 26,
      fontFamily: T.family.extraBold,
      color: D.ink,
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
      backgroundColor: D.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: D.border,
    },

    // ── KPI Cards ────────────────────────────────────
    kpiRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    kpiCard: {
      backgroundColor: D.card,
      borderRadius: radii.lg,
      padding: spacing.sm + 2,
      borderWidth: 1,
      borderColor: D.border,
    },
    kpiLabel: {
      fontSize: 10,
      fontFamily: T.family.semiBold,
      color: D.ink3,
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
      fontFamily: T.family.extraBold,
      color: D.ink,
      lineHeight: 36,
    },
    kpiUnit: {
      fontSize: 13,
      fontFamily: T.family.medium,
      color: D.ink2,
      marginBottom: 4,
    },
    kpiDeltaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    kpiDelta: {
      fontSize: 12,
      fontFamily: T.family.semiBold,
    },
    kpiAvg: {
      fontSize: 26,
      fontFamily: T.family.extraBold,
      color: D.ink,
      lineHeight: 32,
      marginBottom: 2,
    },
    kpiSub: {
      fontSize: 11,
      color: D.ink3,
      fontFamily: T.family.medium,
    },

    // ── Week Strip ───────────────────────────────────
    weekStrip: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    weekNav: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    weekPeriod: {
      fontSize: 13,
      fontFamily: T.family.semiBold,
      color: D.ink2,
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
      backgroundColor: D.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: D.border,
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
      backgroundColor: D.card,
      borderWidth: 1,
      borderColor: D.border,
    },
    dayCellSelected: {
      backgroundColor: D.primary,
      borderColor: D.primary,
    },
    dayName: {
      fontSize: 9,
      fontFamily: T.family.bold,
      color: D.ink3,
      letterSpacing: 0.3,
      marginBottom: 2,
    },
    dayNumber: {
      fontSize: 15,
      fontFamily: T.family.bold,
      color: D.ink,
      marginBottom: 2,
    },
    dayTextSelected: {
      color: D.onPrimary,
    },
    dayCount: {
      fontSize: 11,
      fontFamily: T.family.semiBold,
      color: D.primary,
    },
    dayCountSelected: {
      color: D.onPrimary,
    },
    dayCountZero: {
      color: D.ink3,
    },

    // ── Section label ────────────────────────────────
    sectionLabel: {
      fontSize: 11,
      fontFamily: T.family.bold,
      color: D.ink3,
      letterSpacing: 0.8,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },

    // ── Agenda rows ──────────────────────────────────
    agendaRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    agendaTimeCol: {
      width: 48,
      alignItems: 'flex-start',
      paddingTop: spacing.md,
    },
    agendaHour: {
      fontSize: 15,
      fontFamily: T.family.bold,
      color: D.ink,
      lineHeight: 18,
    },
    agendaDuration: {
      fontSize: 11,
      color: D.ink3,
      fontFamily: T.family.medium,
      marginTop: 1,
    },
    agendaCard: {
      flex: 1,
      backgroundColor: D.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: D.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: 10,
    },
    agendaCardActive: {
      borderColor: D.primary,
    },
    agendaCardExpired: {
      borderColor: D.status.error,
    },
    agendaCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    agendaService: {
      flex: 1,
      fontSize: 16,
      fontFamily: T.family.bold,
      color: D.ink,
    },
    agendaClient: {
      fontSize: 13,
      color: D.ink3,
      fontFamily: T.family.regular,
      marginTop: -4,
    },
    agendaStatusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: D.border,
    },
    agendaStatusPillActive: {
      backgroundColor: D.primaryLight,
      borderColor: D.primary,
    },
    agendaStatusPillExpired: {
      backgroundColor: 'rgba(255,92,57,0.12)',
      borderColor: D.status.error,
    },
    agendaStatusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: D.ink3,
    },
    agendaStatusDotActive: {
      backgroundColor: D.primary,
    },
    agendaStatusDotExpired: {
      backgroundColor: D.status.error,
    },
    agendaStatusText: {
      fontSize: 11,
      fontFamily: T.family.bold,
      color: D.ink2,
    },
    agendaStatusTextActive: {
      color: D.primary,
    },
    agendaStatusTextExpired: {
      color: D.status.error,
    },
    agendaActionButton: {
      alignSelf: 'stretch',
      height: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: radii.md,
      borderWidth: 1.5,
      borderColor: D.primary,
      backgroundColor: 'transparent',
      paddingHorizontal: spacing.md,
    },
    agendaActionButtonDone: {
      backgroundColor: D.primary,
      borderColor: D.primary,
    },
    agendaActionButtonExpired: {
      borderColor: D.status.error,
      backgroundColor: 'rgba(255,92,57,0.1)',
    },
    agendaActionText: {
      fontSize: 13,
      fontFamily: T.family.extraBold,
      color: D.primary,
    },
    agendaActionTextDone: {
      color: D.onPrimary,
    },
    agendaActionTextExpired: {
      color: D.status.error,
    },

    // ── Loading / Empty ──────────────────────────────
    loadingBox: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    emptyState: {
      marginHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
      alignItems: 'center',
      backgroundColor: D.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: D.border,
    },
    emptyTitle: {
      fontSize: 15,
      fontFamily: T.family.semiBold,
      color: D.ink2,
      marginBottom: 4,
    },
    emptyText: {
      fontSize: 13,
      fontFamily: T.family.regular,
      color: D.ink3,
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
      fontFamily: T.family.extraBold,
      color: D.ink,
      letterSpacing: 2,
    },
    bellBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      minWidth: 16,
      height: 16,
      paddingHorizontal: 3,
      borderRadius: 8,
      backgroundColor: D.accent,
      borderWidth: 1.5,
      borderColor: D.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bellBadgeText: {
      fontSize: 9,
      lineHeight: 11,
      fontFamily: T.family.extraBold,
      color: D.onPrimary,
    },

    // ── Perfil — igual ao cliente ───────────────────
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      gap: 16,
      borderBottomWidth: 1,
      borderBottomColor: D.border,
      marginBottom: spacing.lg,
    },
    avatarWrap: {
      width: 82,
      height: 82,
      borderRadius: 41,
    },
    avatar: {
      width: 82,
      height: 82,
      borderRadius: 41,
      backgroundColor: D.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: T.size.display,
      fontFamily: T.family.extraBold,
      color: D.onPrimary,
    },
    cameraBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 29,
      height: 29,
      borderRadius: 15,
      backgroundColor: D.card,
      borderWidth: 2,
      borderColor: D.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileInfo: { flex: 1 },
    greetingText: {
      color: D.ink3,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      fontFamily: T.family.semiBold,
      marginBottom: 3,
    },
    ownerName: {
      color: D.ink,
      fontSize: T.size.titleLarge,
      lineHeight: T.lineHeight.titleLarge,
      fontFamily: T.family.extraBold,
    },
    shopBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: D.primaryLight,
      borderWidth: 1,
      borderColor: 'rgba(212,255,61,0.2)',
    },
    shopBadgeText: {
      fontSize: 10,
      fontFamily: T.family.bold,
      color: D.primary,
    },
    trialBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'center',
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: D.primaryLight,
      borderWidth: 1,
      borderColor: D.borderFocus,
    },
    trialBadgeText: {
      color: D.primary,
      fontSize: T.size.caption,
      lineHeight: T.lineHeight.caption,
      fontFamily: T.family.bold,
    },
    premiumBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'center',
    },
    premiumBadgeText: {
      color: '#C89B3C',
      fontSize: T.size.caption,
      lineHeight: T.lineHeight.caption,
      fontFamily: T.family.extraBold,
    },
  });
}
