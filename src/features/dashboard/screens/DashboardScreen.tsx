import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { launchImageLibrary, type ImageLibraryOptions } from 'react-native-image-picker';
import { getAuth } from '@react-native-firebase/auth';
import { doc, getFirestore, onSnapshot, setDoc } from '@react-native-firebase/firestore';
import {
  ArrowRight,
  Bell,
  Calendar,
  Camera,
  CircleUserRound,
  History,
  Home,
  LogOut,
  MapPin,
  Menu,
  User,
} from 'lucide-react-native';

import { typography as T, useAppTheme, type AppColors } from '@shared/theme';
import { UI } from '@shared/constants/app.constants';
import { useAuth } from '@features/auth';
import { useShop, useShopServices, getShopServiceIcon } from '@features/shops';
import {
  ACTIVE_APPOINTMENT_SET,
  clearShopFavoriteIfNoActive,
  getAppointmentStatusConfig,
  useDashboardAppointments,
} from '@features/appointments';
import type { RootStackParamList } from '@app/types';
import type { UserAppointment } from '@features/appointments';
import { dateUtils } from '@shared/utils/date.utils';
import { formatUtils } from '@shared/utils/format.utils';

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
  const styles = useMemo(() => createStyles(D), [D]);
  const auth = getAuth();
  const user = auth.currentUser!;
  const uid = user.uid;
  const { signOut } = useAuth();
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

  const activeAppointments = useMemo(
    () =>
      appointments.filter(a =>
        (ACTIVE_APPOINTMENT_SET as readonly string[]).includes(a.status as string),
      ),
    [appointments],
  );
  const nextAppointment = activeAppointments[0] ?? null;
  const upcomingAppointments = activeAppointments.slice(0, 3);
  const homeServices = shopServices;

  // Garbage collection: se tem shopId mas zero ativos, desvincula
  useEffect(() => {
    if (loadingAppointments) return;
    if (!shopId || !uid) return;
    if (activeAppointments.length > 0) return;

    clearShopFavoriteIfNoActive(uid, shopId);
  }, [loadingAppointments, shopId, uid, activeAppointments.length]);

  useEffect(() => {
    const db = getFirestore();
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      const data = snap.data() as UserProfile | undefined;
      if (data) setProfile(p => ({ ...p, ...data }));
    });
    return () => unsub();
  }, [uid]);

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
        includeBase64: true,
        quality: 0.7,
        maxWidth: 500,
        maxHeight: 500,
      } as ImageLibraryOptions);
      if (res.didCancel) return;
      const asset = res.assets?.[0];
      if (!asset?.base64) return;
      setSaving(true);
      const b64 = `data:${asset.type?.startsWith('image/') ? asset.type : 'image/jpeg'};base64,${
        asset.base64
      }`;
      await setDoc(doc(getFirestore(), 'users', uid), { photoB64: b64 }, { merge: true });
      setProfile(p => ({ ...p, photoB64: b64 }));
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

  return (
    <>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
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
                onPress={() => Alert.alert('Notificações', 'Em breve!')}
                activeOpacity={0.75}
              >
                <Bell size={20} color={D.ink} strokeWidth={2} />
                <View style={styles.notificationDot} />
              </TouchableOpacity>
            </View>

            <View style={styles.profileBlock}>
              <TouchableOpacity
                style={styles.avatarWrap}
                onPress={saveAvatar}
                activeOpacity={0.8}
                disabled={saving}
              >
                {profile.photoB64 ? (
                  <Image source={{ uri: profile.photoB64 }} style={styles.avatarImg} />
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
                <View style={styles.currentShopCard}>
                  <View style={styles.currentShopIcon}>
                    <MapPin size={16} color={D.primary} />
                  </View>
                  <View style={styles.currentShopText}>
                    <Text style={styles.currentShopLabel}>Sua estética</Text>
                    <Text style={styles.currentShopName} numberOfLines={1}>
                      {shop.name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.currentShopSwap}
                    onPress={() => navigation.navigate('Map')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.currentShopSwapText}>Trocar</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.scheduleCard}
                onPress={goToAppointment}
                activeOpacity={0.88}
              >
                <View style={styles.scheduleIcon}>
                  <Calendar size={24} color={D.primary} strokeWidth={2.1} />
                </View>
                <View style={styles.scheduleTextWrap}>
                  <Text style={styles.scheduleTitle}>Agendar serviço</Text>
                  <Text style={styles.scheduleSubtitle}>
                    {shop ? `em ${shop.name}` : '30s · sem ligar'}
                  </Text>
                </View>
                <View style={styles.scheduleArrow}>
                  <ArrowRight size={22} color={D.primary} strokeWidth={2.1} />
                </View>
              </TouchableOpacity>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionKicker}>Serviços</Text>
              </View>

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
                          <Icon size={22} color={isActive ? D.primary : D.ink2} strokeWidth={2} />
                        </View>
                        <Text style={styles.serviceLabel} numberOfLines={1}>
                          {svc.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.servicesEmpty}>
                  <Text style={styles.servicesEmptyText}>Nenhum serviço disponível</Text>
                </View>
              )}

              <View style={styles.upcomingHeader}>
                <Text style={styles.upcomingTitle}>Próximos serviços</Text>
                <Text style={styles.upcomingCount}>{upcomingAppointments.length} ativos</Text>
              </View>

              {loadingAppointments ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={D.primary} size="small" />
                </View>
              ) : nextAppointment ? (
                <View style={styles.appointmentsCard}>
                  {upcomingAppointments.map((appt, i) => (
                    <AppointmentRow
                      key={appt.id}
                      appt={appt}
                      last={i === upcomingAppointments.length - 1}
                      onPress={() => navigation.navigate('MyAppointments')}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconWrap}>
                    <Calendar size={32} color={D.primary} strokeWidth={2.1} />
                    <View style={styles.emptyPlus}>
                      <Text style={styles.emptyPlusText}>+</Text>
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
            </>
          )}

          <View style={{ height: 112 }} />
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

function AppointmentRow({
  appt,
  last,
  onPress,
}: {
  appt: UserAppointment;
  last: boolean;
  onPress: () => void;
}) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const statusConfig = getAppointmentStatusConfig(appt.status);

  return (
    <TouchableOpacity
      style={[styles.appointmentRow, !last && styles.appointmentRowBorder]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={styles.appointmentIcon}>
        <Calendar size={22} color={D.primary} />
      </View>
      <View style={styles.appointmentInfo}>
        <Text style={styles.appointmentTitle} numberOfLines={1}>
          {appt.serviceLabel ?? 'Serviço'}
        </Text>
        <Text style={styles.appointmentMeta} numberOfLines={1}>
          {dateUtils.formatDate(appt.startAtMs)} · {dateUtils.formatHour(appt.startAtMs)} ·{' '}
          {appt.carCategory ?? appt.vehicleType}
        </Text>
        <View
          style={[
            styles.appointmentStatusBadge,
            { backgroundColor: statusConfig.color + '20', borderColor: statusConfig.color },
          ]}
        >
          <View style={[styles.appointmentStatusDot, { backgroundColor: statusConfig.color }]} />
          <Text style={[styles.appointmentStatusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>
      <Text style={styles.appointmentPrice}>{formatUtils.currencyCompact(appt.price)}</Text>
    </TouchableOpacity>
  );
}

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

function createStyles(D: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: D.bg },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 16 },

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
    notificationDot: {
      position: 'absolute',
      width: 6,
      height: 6,
      borderRadius: 3,
      right: 9,
      top: 8,
      backgroundColor: D.primary,
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

    currentShopCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 20,
      marginTop: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: D.surface,
      borderWidth: 1,
      borderColor: D.border,
      gap: 10,
    },
    currentShopIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: D.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    currentShopText: { flex: 1 },
    currentShopLabel: {
      fontSize: T.size.caption,
      color: D.ink3,
      fontFamily: T.family.semiBold,
      letterSpacing: 0.3,
    },
    currentShopName: {
      fontSize: T.size.body,
      color: D.ink,
      fontFamily: T.family.bold,
      marginTop: 1,
    },
    currentShopSwap: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: D.borderFocus,
    },
    currentShopSwapText: {
      fontSize: T.size.caption,
      color: D.primary,
      fontFamily: T.family.bold,
    },

    scheduleCard: {
      minHeight: 72,
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 18,
      paddingHorizontal: 18,
      borderRadius: 18,
      backgroundColor: D.primary,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      shadowColor: D.primary,
      shadowOpacity: 0.22,
      shadowOffset: { width: 0, height: 9 },
      shadowRadius: 12,
      elevation: 8,
    },
    scheduleIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: D.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scheduleTextWrap: { flex: 1 },
    scheduleTitle: {
      color: D.onPrimary,
      fontSize: T.size.bodyLarge,
      fontFamily: T.family.extraBold,
      lineHeight: T.lineHeight.bodyLarge,
    },
    scheduleSubtitle: {
      color: D.onPrimary,
      opacity: 0.72,
      fontSize: T.size.secondary,
      fontFamily: T.family.medium,
      marginTop: 2,
    },
    scheduleArrow: {
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
      marginBottom: 11,
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
      paddingBottom: 18,
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
      marginBottom: 17,
    },
    servicesEmptyText: {
      color: D.ink3,
      fontSize: T.size.secondary,
      fontFamily: T.family.extraBold,
    },
    serviceCard: {
      width: 104,
      height: 104,
      borderRadius: 18,
      backgroundColor: D.card,
      borderWidth: 1.5,
      borderColor: D.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    serviceIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: D.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    serviceIconActive: {
      borderColor: D.primary,
    },
    serviceLabel: {
      color: D.ink2,
      fontSize: T.size.secondary,
      fontFamily: T.family.bold,
    },

    upcomingHeader: {
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
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
      minHeight: 180,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appointmentsCard: {
      marginHorizontal: 20,
      borderRadius: 17,
      backgroundColor: D.card,
      borderWidth: 1.5,
      borderColor: D.borderStrong,
      overflow: 'hidden',
    },
    appointmentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 12,
      gap: 10,
    },
    appointmentRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: D.border,
    },
    appointmentIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: D.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appointmentInfo: { flex: 1 },
    appointmentStatusBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 6,
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
      marginBottom: 4,
    },
    appointmentMeta: {
      color: D.ink3,
      fontSize: T.size.secondary,
      fontFamily: T.family.medium,
    },
    appointmentPrice: {
      color: D.primary,
      fontSize: T.size.secondary,
      fontFamily: T.family.bold,
    },
    emptyCard: {
      marginHorizontal: 20,
      minHeight: 224,
      borderRadius: 20,
      backgroundColor: D.card,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: D.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 26,
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
    emptyPlusText: {
      color: D.onPrimary,
      fontSize: T.size.secondary,
      fontFamily: T.family.bold,
      lineHeight: T.lineHeight.secondary,
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
      height: 36,
      minWidth: 120,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: D.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 15,
    },
    emptyButtonText: {
      color: D.primary,
      fontSize: T.size.body,
      fontFamily: T.family.bold,
    },

    bottomNav: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 86,
      backgroundColor: D.surface,
      borderTopWidth: 1,
      borderTopColor: D.borderStrong,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-start',
      paddingTop: 14,
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
      paddingVertical: 12,
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
