import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { launchImageLibrary, type ImageLibraryOptions } from 'react-native-image-picker';
import { getAuth } from '@react-native-firebase/auth';
import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';
import {
  ArrowRight,
  Bell,
  Calendar,
  Camera,
  CircleUserRound,
  History,
  Home,
  Info,
  LogOut,
  MapPin,
  Menu,
  Plus,
  User,
} from 'lucide-react-native';

import { typography as T, useAppTheme, type AppColors } from '@shared/theme';
import { UI } from '@shared/constants/app.constants';
import { useAuth, useMeStore } from '@features/auth';
import { useShop, useShopServices, getShopServiceIcon } from '@features/shops';
import { getShopSettings } from '@features/settings';
import { useRegisterPushToken, useUserNotifications } from '@features/notifications';
import {
  ACTIVE_APPOINTMENT_SET,
  clearShopFavoriteIfNoActive,
  getAppointmentStatusConfig,
  isExpiredScheduled,
  useDashboardAppointments,
} from '@features/appointments';
import type { RootStackParamList } from '@app/types';
import type { UserAppointment } from '@features/appointments';
import { dateUtils } from '@shared/utils/date.utils';
import { formatUtils } from '@shared/utils/format.utils';
import { useNowTick } from '@shared/hooks/useNowTick';
import { uploadProfilePhoto } from '@shared/services/userPhoto.service';
import { FadeInUp } from '@shared/components/FadeInUp';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type UserProfile = {
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  photoB64?: string;
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function DashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors: D, isLight } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 42 : 16);
  const styles = useMemo(() => createStyles(D, bottomInset), [D, bottomInset]);
  const auth = getAuth();
  const user = auth.currentUser!;
  const uid = user.uid;
  const { signOut } = useAuth();

  // Registra o token de push do cliente (para receber lembrete de agendamento).
  useRegisterPushToken(uid);
  const { unreadCount } = useUserNotifications(uid);
  const { shopId, shop } = useShop();

  const [profile, setProfile] = useState<UserProfile>({
    photoURL: user.photoURL ?? undefined,
  });
  const [saving, setSaving] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-UI.MENU_WIDTH)).current;

  const { loading: loadingAppointments, items: appointments } = useDashboardAppointments({
    uid,
    shopId: shopId ?? '',
    limitN: 30,
  });
  const { loading: loadingServices, items: shopServices } = useShopServices({
    shopId,
    activeOnly: true,
  });

  // Telefone e horários da estética vinculada — usados no card de informações
  const [shopPhone, setShopPhone] = useState<string | null>(null);
  const [shopHours, setShopHours] = useState<{ open: number; close: number } | null>(null);

  // useFocusEffect: só escuta o telefone do owner enquanto o Dashboard está em foco.
  useFocusEffect(
    useCallback(() => {
      if (!shop?.ownerId || !shopId) {
        setShopPhone(null);
        setShopHours(null);
        return;
      }
      const db = getFirestore();
      // Busca telefone do owner. O cliente pode não ter permissão de ler o doc de
      // outro usuário (regras do Firestore) — nesse caso o erro é tratado e o
      // telefone fica indisponível, sem quebrar o app.
      const unsub = onSnapshot(
        doc(db, 'users', shop.ownerId),
        snap => {
          const data = snap?.data() as { phone?: string } | undefined;
          setShopPhone(data?.phone ?? null);
        },
        () => setShopPhone(null),
      );
      // Busca horários reais do shop
      getShopSettings(shopId)
        .then(s => setShopHours({ open: s.openHour, close: s.closeHour }))
        .catch(() => {});
      return () => unsub();
    }, [shop?.ownerId, shopId]),
  );

  const activeAppointments = useMemo(
    () =>
      appointments.filter(a =>
        (ACTIVE_APPOINTMENT_SET as readonly string[]).includes(a.status as string),
      ),
    [appointments],
  );
  // Tick de relógio: força recalcular "vencido" com o tempo passando (o dado no
  // banco não muda quando o agendamento expira). Sem isso o card ficaria preso.
  const now = useNowTick();

  // "Próximos" só mostra agendamentos futuros: os vencidos (passou do horário e o
  // estabelecimento ainda não deu baixa) saem daqui — viram pendentes no histórico.
  const upcomingActive = useMemo(
    () => activeAppointments.filter(a => !isExpiredScheduled(a.status, a.startAtMs, now)),
    [activeAppointments, now],
  );
  const nextAppointment = upcomingActive[0] ?? null;
  const upcomingAppointments = upcomingActive.slice(0, 3);
  const homeServices = shopServices;
  const appointmentCardWidth = Math.max(280, windowWidth - 72);

  // Callbacks estáveis p/ a lista de próximos: sem isso, o React.memo do card não
  // segura o re-render a cada tick de relógio (useNowTick).
  const goToMyAppointments = useCallback(() => navigation.navigate('MyAppointments'), [navigation]);
  const renderAppointment = useCallback(
    ({ item }: { item: UserAppointment }) => (
      <AppointmentCard appt={item} width={appointmentCardWidth} onPress={goToMyAppointments} />
    ),
    [appointmentCardWidth, goToMyAppointments],
  );
  const renderAppointmentSeparator = useCallback(
    () => <View style={styles.appointmentCardGap} />,
    [styles],
  );

  // Desvincula a estética favorita quando não há mais serviços ativos NÃO vencidos.
  // Um agendamento vencido (passou do horário) não segura mais o vínculo: o
  // Dashboard volta ao estado de "encontrar uma estética" em vez de ficar preso
  // ligado ao shop sem nenhum próximo serviço.
  useEffect(() => {
    if (loadingAppointments) return;
    if (!shopId || !uid) return;
    if (upcomingActive.length > 0) return;

    clearShopFavoriteIfNoActive(uid, shopId);
  }, [loadingAppointments, shopId, uid, upcomingActive.length]);

  // Perfil vem do listener único de users/{uid} (useMeStore), sem onSnapshot aqui.
  const me = useMeStore(s => s.me);
  useEffect(() => {
    if (!me) return;
    setProfile(p => ({
      ...p,
      firstName: me.firstName,
      lastName: me.lastName,
      photoB64: me.photoB64,
      photoURL: me.photoURL ?? p.photoURL,
    }));
  }, [me]);

  const initials = useMemo(() => {
    if (profile.firstName) {
      return `${profile.firstName[0]}${profile.lastName?.[0] ?? ''}`.toUpperCase();
    }

    return (
      user.displayName
        ?.split(' ')
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() ?? 'U'
    );
  }, [profile.firstName, profile.lastName, user.displayName]);

  const displayName = useMemo(() => {
    const profileName = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim();
    return profileName || user.displayName || 'Você';
  }, [profile.firstName, profile.lastName, user.displayName]);

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
      if (!asset?.uri) return;
      setSaving(true);
      const result = await uploadProfilePhoto(uid, asset.uri);
      if (!result.ok) {
        Alert.alert('Erro', result.message);
        return;
      }
      setProfile(p => ({ ...p, photoURL: result.url, photoB64: undefined }));
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar a foto');
    } finally {
      setSaving(false);
    }
  };

  const toggleMenu = () => {
    if (menuVisible) {
      Animated.timing(slideAnim, {
        toValue: -UI.MENU_WIDTH,
        duration: UI.DRAWER_ANIMATION_DURATION,
        useNativeDriver: true,
      }).start(() => setMenuVisible(false));
    } else {
      setMenuVisible(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: UI.DRAWER_ANIMATION_DURATION,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleSignOut = async () => {
    toggleMenu();
    await signOut();
  };

  const goToAppointment = () => {
    if (!shopId) {
      navigation.navigate('Map');
      return;
    }
    navigation.navigate('Appointment');
  };

  const showShopInfo = () => {
    if (!shop) return;
    const address = [shop.location?.address, shop.location?.city].filter(Boolean).join(' - ');
    const hoursText = shopHours
      ? `${String(shopHours.open).padStart(2, '0')}h às ${String(shopHours.close).padStart(
          2,
          '0',
        )}h`
      : null;
    const phoneText = shopPhone ? formatUtils.phoneMask(shopPhone) : 'Não informado';
    const lines = [
      address ? `📍 ${address}` : '📍 Endereço não informado',
      hoursText ? `🕐 Atendimento: ${hoursText}` : null,
      `📞 Telefone: ${phoneText}`,
    ].filter(Boolean) as string[];
    Alert.alert(shop.name, lines.join('\n\n'));
  };

  return (
    <>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={false}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSurface}>
            <View style={styles.heroGlow} />

            <View style={styles.topBar}>
              <TouchableOpacity style={styles.squareBtn} onPress={toggleMenu} activeOpacity={0.75}>
                <Menu size={20} color={D.ink} strokeWidth={2.4} />
              </TouchableOpacity>

              <Text style={styles.brand}>DETAILGO</Text>

              <TouchableOpacity
                style={styles.squareBtn}
                onPress={() => navigation.navigate('Notifications')}
                activeOpacity={0.75}
              >
                <Bell size={20} color={D.ink} strokeWidth={2} />
                {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.profileBlock}>
              <TouchableOpacity
                style={styles.avatarWrap}
                onPress={saveAvatar}
                activeOpacity={0.8}
                disabled={saving}
              >
                {profile.photoURL || profile.photoB64 ? (
                  <Image
                    source={{ uri: profile.photoURL ?? profile.photoB64 }}
                    style={styles.avatarImg}
                  />
                ) : (
                  <View style={styles.avatarInitials}>
                    <Text style={styles.avatarInitialsText}>{initials}</Text>
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  {saving ? (
                    <ActivityIndicator color={D.primary} size="small" />
                  ) : (
                    <Camera size={12} color={D.primary} strokeWidth={2.4} />
                  )}
                </View>
              </TouchableOpacity>

              <View style={styles.profileInfo}>
                <Text style={styles.greeting}>{getGreeting()}</Text>
                <Text style={styles.profileName} numberOfLines={1}>
                  {displayName}
                </Text>
                <View style={styles.profileRolePill}>
                  <Text style={styles.profileRoleText}>Cliente</Text>
                </View>
              </View>
            </View>
          </View>

          {!shopId ? (
            // Cliente novo — direciona para o mapa em vez de mostrar agendamento vazio
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <MapPin size={32} color={D.primary} strokeWidth={2.1} />
              </View>
              <Text style={styles.emptyTitle}>Encontre uma estética</Text>
              <Text style={styles.emptyText}>Veja no mapa quem está próximo de você</Text>
              <Text style={styles.emptyText}>e agende seu primeiro serviço.</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('Map')}
                activeOpacity={0.82}
              >
                <Text style={styles.emptyButtonText}>Explorar mapa</Text>
                <ArrowRight size={19} color={D.primary} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {shop && (
                <FadeInUp delay={0}>
                  <View style={styles.shopActionCard}>
                    <TouchableOpacity
                      style={styles.shopActionMain}
                      onPress={goToAppointment}
                      activeOpacity={0.88}
                    >
                      <View style={styles.scheduleIcon}>
                        <Calendar size={22} color={D.primary} strokeWidth={2.1} />
                      </View>
                      <View style={styles.shopActionScheduleCopy}>
                        <Text style={styles.shopActionScheduleText}>Agendar serviço</Text>
                        <Text style={styles.shopActionScheduleSub} numberOfLines={1}>
                          em {shop.name}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.shopActionButtons}>
                      <TouchableOpacity
                        style={styles.shopActionIconButton}
                        onPress={showShopInfo}
                        activeOpacity={0.75}
                      >
                        <Info size={18} color={D.primary} strokeWidth={2.2} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.shopActionArrow}
                        onPress={goToAppointment}
                        activeOpacity={0.75}
                      >
                        <ArrowRight size={18} color={D.primary} strokeWidth={2.1} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </FadeInUp>
              )}

              <FadeInUp delay={150} style={styles.sectionHeader}>
                <Text style={styles.sectionKicker}>Serviços oferecidos pela estética</Text>
              </FadeInUp>

              {loadingServices ? (
                <View style={styles.servicesLoading}>
                  <ActivityIndicator color={D.primary} size="small" />
                </View>
              ) : homeServices.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.servicesRail}
                >
                  {homeServices.map((svc, index) => {
                    const Icon = getShopServiceIcon(svc);
                    const isActive = index === 0;
                    return (
                      <TouchableOpacity
                        key={svc.id}
                        style={styles.serviceCard}
                        onPress={goToAppointment}
                        activeOpacity={0.82}
                      >
                        <View
                          style={[styles.serviceIconWrap, isActive && styles.serviceIconActive]}
                        >
                          <Icon size={16} color={isActive ? D.primary : D.ink2} strokeWidth={2} />
                        </View>
                        <Text style={styles.serviceLabel}>{svc.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.servicesEmpty}>
                  <Text style={styles.servicesEmptyText}>Nenhum serviço disponível</Text>
                </View>
              )}

              <FadeInUp delay={340}>
                <View style={styles.upcomingHeader}>
                  <Text style={styles.upcomingTitle}>Próximos serviços</Text>
                  <Text style={styles.upcomingCount}>{upcomingAppointments.length} ativos</Text>
                </View>

                {loadingAppointments ? (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator color={D.primary} size="small" />
                  </View>
                ) : nextAppointment ? (
                  <FlatList
                    horizontal
                    pagingEnabled
                    snapToInterval={appointmentCardWidth + 12}
                    decelerationRate="fast"
                    showsHorizontalScrollIndicator={false}
                    data={upcomingAppointments}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.appointmentsRail}
                    ItemSeparatorComponent={renderAppointmentSeparator}
                    renderItem={renderAppointment}
                  />
                ) : (
                  <View style={styles.emptyCard}>
                    <View style={styles.emptyIconWrap}>
                      <Calendar size={32} color={D.primary} strokeWidth={2.1} />
                      <View style={styles.emptyPlus}>
                        <Plus size={12} color={D.onPrimary} strokeWidth={3} />
                      </View>
                    </View>
                    <Text style={styles.emptyTitle}>Sem agendamentos</Text>
                    <Text style={styles.emptyText}>Que tal cuidar do seu carro hoje?</Text>
                    <Text style={styles.emptyText}>Em 30 segundos você marca o primeiro.</Text>
                    <TouchableOpacity
                      style={styles.emptyButton}
                      onPress={goToAppointment}
                      activeOpacity={0.82}
                    >
                      <Text style={styles.emptyButtonText}>Começar</Text>
                      <ArrowRight size={19} color={D.primary} strokeWidth={2.4} />
                    </TouchableOpacity>
                  </View>
                )}
              </FadeInUp>
            </>
          )}

          <View style={styles.dashboardBottomSpacer} />
        </ScrollView>

        <View style={styles.bottomNav}>
          <BottomNavItem active icon={<Home size={24} color={D.primary} />} label="Início" />
          <BottomNavItem
            icon={<MapPin size={24} color={D.ink3} />}
            label="Explorar"
            onPress={() => navigation.navigate('Map')}
          />
          <BottomNavItem
            icon={<History size={24} color={D.ink3} />}
            label="Histórico"
            onPress={() => navigation.navigate('History')}
          />
          <BottomNavItem
            icon={<CircleUserRound size={24} color={D.ink3} />}
            label="Perfil"
            onPress={() => navigation.navigate('Profile')}
          />
        </View>

        {menuVisible && (
          <>
            <Pressable style={styles.overlay} onPress={toggleMenu} />
            <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
              <View style={styles.drawerHeader}>
                <View style={styles.drawerAvatar}>
                  <Text style={styles.drawerAvatarText}>{initials}</Text>
                </View>
                <Text style={styles.drawerName}>{displayName}</Text>
                <Text style={styles.drawerEmail}>{user.email}</Text>
              </View>

              <View style={styles.drawerMenu}>
                <DrawerItem
                  icon={<Calendar size={18} color={D.primary} />}
                  label="Meus agendamentos"
                  onPress={() => {
                    toggleMenu();
                    navigation.navigate('MyAppointments');
                  }}
                />
                <DrawerItem
                  icon={<History size={18} color={D.primary} />}
                  label="Histórico"
                  onPress={() => {
                    toggleMenu();
                    navigation.navigate('History');
                  }}
                />
                <DrawerItem
                  icon={<User size={18} color={D.primary} />}
                  label="Perfil"
                  onPress={() => {
                    toggleMenu();
                    navigation.navigate('Profile');
                  }}
                />
                <DrawerItem
                  icon={<MapPin size={18} color={D.primary} />}
                  label="Explorar estéticas"
                  onPress={() => {
                    toggleMenu();
                    navigation.navigate('Map');
                  }}
                />
              </View>

              <View style={styles.drawerDivider} />

              <DrawerItem
                icon={<LogOut size={18} color={D.accent} />}
                label="Sair"
                onPress={handleSignOut}
                danger
              />
            </Animated.View>
          </>
        )}
      </SafeAreaView>
    </>
  );
}

const AppointmentCard = memo(function AppointmentCard({
  appt,
  width,
  onPress,
}: {
  appt: UserAppointment;
  width: number;
  onPress: () => void;
}) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const statusConfig = getAppointmentStatusConfig(appt.status);

  return (
    <TouchableOpacity
      style={[styles.appointmentCard, { width }]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={styles.appointmentCardTop}>
        <View style={styles.appointmentIcon}>
          <Calendar size={22} color={D.primary} />
        </View>
        <View style={styles.appointmentInfo}>
          <View style={styles.appointmentTitleRow}>
            <Text style={styles.appointmentTitle} numberOfLines={1}>
              {appt.serviceLabel ?? 'Serviço'}
            </Text>
            <Text style={styles.appointmentPrice}>{formatUtils.currencyCompact(appt.price)}</Text>
          </View>
          <Text style={styles.appointmentMeta} numberOfLines={1}>
            {dateUtils.formatDate(appt.startAtMs)} - {dateUtils.formatHour(appt.startAtMs)}
          </Text>
          <View style={styles.appointmentFooter}>
            <Text style={styles.appointmentVehicle} numberOfLines={1}>
              {appt.carCategory ?? appt.vehicleType}
            </Text>
            <View
              style={[
                styles.appointmentStatusBadge,
                { backgroundColor: statusConfig.color + '20', borderColor: statusConfig.color },
              ]}
            >
              <View
                style={[styles.appointmentStatusDot, { backgroundColor: statusConfig.color }]}
              />
              <Text style={[styles.appointmentStatusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

function BottomNavItem({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);

  return (
    <TouchableOpacity
      style={styles.bottomNavItem}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
    >
      {icon}
      <Text style={[styles.bottomNavLabel, active && styles.bottomNavLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function DrawerItem({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);

  return (
    <TouchableOpacity style={styles.drawerItem} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <Text style={[styles.drawerItemText, danger && styles.drawerItemDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(D: AppColors, bottomInset = 0) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: D.bg },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 0 },

    heroSurface: {
      minHeight: 190,
      borderBottomWidth: 1,
      borderBottomColor: D.borderStrong,
      overflow: 'hidden',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
    },
    heroGlow: {
      position: 'absolute',
      width: 180,
      height: 140,
      right: -55,
      top: 9,
      borderRadius: 90,
      backgroundColor: D.primaryLight,
    },
    topBar: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    squareBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: D.surface,
      borderWidth: 1.5,
      borderColor: D.borderStrong,
    },
    brand: {
      color: D.ink,
      fontSize: T.size.secondary,
      fontFamily: T.family.extraBold,
      letterSpacing: 4,
      marginLeft: 4,
    },
    notificationBadge: {
      position: 'absolute',
      top: 3,
      right: 3,
      minWidth: 16,
      height: 16,
      paddingHorizontal: 3,
      borderRadius: 8,
      backgroundColor: D.accent,
      borderWidth: 1.5,
      borderColor: D.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationBadgeText: {
      fontSize: 9,
      lineHeight: 11,
      fontFamily: T.family.extraBold,
      color: D.onPrimary,
    },
    profileBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    avatarWrap: {
      width: 82,
      height: 82,
      position: 'relative',
    },
    avatarImg: {
      width: 82,
      height: 82,
      borderRadius: 41,
    },
    avatarInitials: {
      width: 82,
      height: 82,
      borderRadius: 41,
      backgroundColor: D.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitialsText: {
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
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: D.bg,
    },
    profileInfo: { flex: 1 },
    greeting: {
      color: D.ink3,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      fontFamily: T.family.semiBold,
      marginBottom: 3,
    },
    profileName: {
      color: D.ink,
      fontSize: T.size.titleLarge,
      lineHeight: T.lineHeight.titleLarge,
      fontFamily: T.family.extraBold,
    },
    profileRolePill: {
      alignSelf: 'flex-start',
      marginTop: 6,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: D.primaryLight,
      borderWidth: 1,
      borderColor: D.borderFocus,
    },
    profileRoleText: {
      color: D.primary,
      fontSize: T.size.caption,
      lineHeight: T.lineHeight.caption,
      fontFamily: T.family.bold,
    },

    shopActionCard: {
      minHeight: 76,
      marginHorizontal: 20,
      marginTop: 18,
      marginBottom: 22,
      paddingHorizontal: 14,
      borderRadius: 18,
      backgroundColor: D.primary,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      shadowColor: D.primary,
      shadowOpacity: 0.22,
      shadowOffset: { width: 0, height: 9 },
      shadowRadius: 12,
      elevation: 8,
    },
    shopActionMain: {
      flex: 1,
      minWidth: 0,
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    scheduleIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: D.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shopActionScheduleCopy: {
      flex: 1,
      minWidth: 0,
    },
    shopActionScheduleText: {
      color: D.onPrimary,
      fontSize: T.size.bodyLarge,
      fontFamily: T.family.extraBold,
      lineHeight: T.lineHeight.bodyLarge,
    },
    shopActionScheduleSub: {
      color: D.onPrimary,
      opacity: 0.72,
      fontSize: T.size.secondary,
      fontFamily: T.family.medium,
      marginTop: 2,
    },
    shopActionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    shopActionIconButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: D.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shopActionArrow: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: D.card,
      alignItems: 'center',
      justifyContent: 'center',
    },

    sectionHeader: {
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionKicker: {
      color: D.ink2,
      fontSize: T.size.secondary,
      fontFamily: T.family.bold,
    },
    servicesRail: {
      paddingHorizontal: 20,
      flexDirection: 'row',
      gap: 10,
      paddingBottom: 26,
    },
    servicesLoading: {
      height: 100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    servicesEmpty: {
      marginHorizontal: 20,
      height: 72,
      borderRadius: 15,
      backgroundColor: D.card,
      borderWidth: 1,
      borderColor: D.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 28,
    },
    servicesEmptyText: {
      color: D.ink3,
      fontSize: T.size.secondary,
      fontFamily: T.family.extraBold,
    },
    serviceCard: {
      width: 90,
      borderRadius: 16,
      backgroundColor: D.card,
      borderWidth: 1.5,
      borderColor: D.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      paddingVertical: 10,
    },
    serviceIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: D.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    serviceIconActive: {
      borderColor: D.primary,
    },
    serviceLabel: {
      color: D.ink2,
      fontSize: T.size.caption,
      fontFamily: T.family.bold,
      textAlign: 'center',
    },

    upcomingHeader: {
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    upcomingTitle: {
      color: D.ink,
      fontSize: T.size.bodyLarge,
      fontFamily: T.family.extraBold,
      lineHeight: T.lineHeight.bodyLarge,
    },
    upcomingCount: {
      color: D.ink3,
      fontSize: T.size.secondary,
      fontFamily: T.family.medium,
    },
    loadingWrap: {
      marginHorizontal: 20,
      minHeight: 112,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appointmentsRail: {
      paddingHorizontal: 20,
      paddingBottom: 0,
    },
    appointmentCardGap: {
      width: 12,
    },
    appointmentCard: {
      minHeight: 132,
      borderRadius: 18,
      backgroundColor: D.card,
      borderWidth: 1.5,
      borderColor: D.borderStrong,
      paddingHorizontal: 16,
      paddingVertical: 14,
      justifyContent: 'center',
    },
    appointmentCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    appointmentIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: D.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appointmentInfo: { flex: 1, minWidth: 0 },
    appointmentTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 4,
    },
    appointmentStatusBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
    },
    appointmentStatusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    appointmentStatusText: {
      fontSize: 10,
      fontFamily: T.family.bold,
      letterSpacing: 0.3,
    },
    appointmentTitle: {
      color: D.ink,
      fontSize: T.size.body,
      fontFamily: T.family.bold,
      flex: 1,
      minWidth: 0,
    },
    appointmentMeta: {
      color: D.ink3,
      fontSize: T.size.secondary,
      fontFamily: T.family.medium,
    },
    appointmentFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginTop: 8,
    },
    appointmentVehicle: {
      flex: 1,
      color: D.ink2,
      fontSize: T.size.caption,
      fontFamily: T.family.bold,
    },
    appointmentPrice: {
      color: D.primary,
      fontSize: T.size.secondary,
      fontFamily: T.family.bold,
      flexShrink: 0,
    },
    emptyCard: {
      marginHorizontal: 20,
      marginTop: 20,
      minHeight: 224,
      borderRadius: 20,
      backgroundColor: D.card,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: D.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 26,
    },
    emptyIconWrap: {
      width: 68,
      height: 68,
      borderRadius: 20,
      backgroundColor: D.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 15,
    },
    emptyPlus: {
      position: 'absolute',
      right: -4,
      top: -4,
      width: 19,
      height: 19,
      borderRadius: 10,
      backgroundColor: D.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      color: D.ink,
      fontSize: T.size.bodyLarge,
      fontFamily: T.family.extraBold,
      marginBottom: 10,
    },
    emptyText: {
      color: D.ink2,
      fontSize: T.size.body,
      fontFamily: T.family.medium,
      lineHeight: T.lineHeight.body,
      textAlign: 'center',
    },
    emptyButton: {
      minHeight: 44,
      minWidth: 172,
      borderRadius: 22,
      borderWidth: 2,
      borderColor: D.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 18,
      paddingHorizontal: 18,
    },
    emptyButtonText: {
      color: D.primary,
      fontSize: T.size.body,
      fontFamily: T.family.bold,
    },

    dashboardBottomSpacer: {
      height: 72 + bottomInset,
    },

    bottomNav: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 72 + bottomInset,
      backgroundColor: D.surface,
      borderTopWidth: 1,
      borderTopColor: D.borderStrong,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-start',
      paddingTop: 14,
      paddingBottom: bottomInset,
    },
    bottomNavItem: {
      width: 96,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bottomNavLabel: {
      marginTop: 4,
      color: D.ink3,
      fontSize: T.size.caption,
      fontFamily: T.family.bold,
    },
    bottomNavLabelActive: {
      color: D.primary,
    },

    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: D.overlay },
    drawer: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: UI.MENU_WIDTH,
      backgroundColor: D.surface,
      borderRightWidth: 1,
      borderRightColor: D.border,
      paddingTop: 60,
    },
    drawerHeader: {
      paddingHorizontal: 20,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: D.border,
    },
    drawerAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: D.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    drawerAvatarText: {
      fontSize: T.size.body,
      fontFamily: T.family.bold,
      color: D.onPrimary,
    },
    drawerName: {
      fontSize: T.size.body,
      fontFamily: T.family.bold,
      color: D.ink,
      marginBottom: 2,
    },
    drawerEmail: { fontFamily: T.family.regular, fontSize: T.size.secondary, color: D.ink3 },
    drawerMenu: { paddingTop: 12 },
    drawerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 20,
    },
    drawerItemText: {
      fontSize: T.size.body,
      fontFamily: T.family.medium,
      color: D.ink,
    },
    drawerItemDanger: { color: D.accent },
    drawerDivider: { height: 1, backgroundColor: D.border, marginVertical: 8 },

    modalOverlay: {
      flex: 1,
      backgroundColor: D.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalBox: {
      backgroundColor: D.card,
      borderRadius: 20,
      padding: 24,
      width: '100%',
      maxWidth: 360,
      borderWidth: 1,
      borderColor: D.border,
    },
    modalTitle: {
      fontSize: T.size.bodyLarge,
      fontFamily: T.family.bold,
      color: D.ink,
      marginBottom: 6,
    },
    modalDesc: {
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      color: D.ink2,
      lineHeight: T.lineHeight.secondary,
      marginBottom: 18,
    },
    modalInput: {
      borderWidth: 1.5,
      borderColor: D.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: T.size.titleLarge,
      fontFamily: T.family.semiBold,
      color: D.ink,
      textAlign: 'center',
      letterSpacing: 6,
      marginBottom: 14,
      backgroundColor: D.card,
    },
    modalBtn: {
      height: 48,
      backgroundColor: D.primary,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    modalBtnDisabled: { opacity: 0.35 },
    modalBtnText: {
      color: D.onPrimary,
      fontSize: T.size.body,
      fontFamily: T.family.bold,
    },
    modalCancel: { alignItems: 'center', paddingVertical: 8 },
    modalCancelText: {
      fontSize: T.size.secondary,
      color: D.ink3,
      fontFamily: T.family.semiBold,
    },
  });
}
