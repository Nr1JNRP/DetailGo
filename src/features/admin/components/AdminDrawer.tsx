import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar, History, LogOut, Settings, Store, User } from 'lucide-react-native';
import { getAuth, signOut } from '@react-native-firebase/auth';

import { typography as T, useAppTheme, type AppColors } from '@shared/theme';
import ConfirmModal from '@shared/components/ConfirmModal';
import { useFeedback } from '@shared/components/FeedbackProvider';
import { UI } from '@shared/constants/app.constants';
import { useMeStore } from '@features/auth';
import { useShop, useShopServices } from '@features/shops';
import type { RootStackParamList } from '@app/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  visible: boolean;
  slideAnim: Animated.Value;
  onClose: () => void;
};

type DrawerStyles = ReturnType<typeof createStyles>;

export default function AdminDrawer({ visible, slideAnim, onClose }: Props) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const navigation = useNavigation<Nav>();
  const { showError } = useFeedback();
  const { shop, shopId } = useShop();
  const auth = getAuth();
  const user = auth.currentUser;

  // Foto vem do listener único de users/{uid} (useMeStore), sem onSnapshot aqui.
  const photoB64 = useMeStore(s => s.me?.photoURL ?? s.me?.photoB64 ?? null);

  // Verifica se há serviços cadastrados e notifica o owner na primeira abertura
  const { items: services, loading: loadingServices } = useShopServices({
    shopId,
    ensureDefaults: false,
  });
  const alertedRef = useRef(false);
  const [servicesConfirmVisible, setServicesConfirmVisible] = React.useState(false);
  const [signOutConfirmVisible, setSignOutConfirmVisible] = React.useState(false);

  useEffect(() => {
    if (!visible) {
      alertedRef.current = false; // reseta ao fechar para alertar na próxima abertura
      return;
    }
    if (loadingServices) return;
    if (services.length === 0 && !alertedRef.current) {
      alertedRef.current = true;
      setServicesConfirmVisible(true);
    }
  }, [visible, loadingServices, services.length, navigation, onClose]);

  const shopName = shop?.name ?? 'Minha estética';
  const ownerName = user?.displayName ?? 'Proprietário';

  const initials = ownerName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const navigate = (route: keyof RootStackParamList) => {
    onClose();
    navigation.navigate(route as any);
  };

  const handleSignOut = () => {
    setSignOutConfirmVisible(true);
  };

  const confirmSignOut = async () => {
    setSignOutConfirmVisible(false);
    try {
      onClose();
      await signOut(auth);
    } catch {
      showError('Falha ao sair da conta.');
    }
  };

  if (!visible) return null;

  return (
    <>
      <Pressable style={styles.overlay} onPress={onClose} />
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        {/* ── Perfil ── */}
        <View style={styles.drawerHeader}>
          {photoB64 ? (
            <Image source={{ uri: photoB64 }} style={styles.drawerAvatar} />
          ) : (
            <View style={styles.drawerAvatar}>
              <Text style={styles.drawerAvatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.ownerRow}>
            <Text style={styles.drawerName} numberOfLines={1}>
              {ownerName}
            </Text>
            <View style={styles.shopBadge}>
              <Store size={10} color={D.primary} />
              <Text style={styles.shopBadgeText} numberOfLines={1}>
                {shopName}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Navegação ── */}
        <View style={styles.drawerMenu}>
          <DrawerItem
            styles={styles}
            icon={<Calendar size={18} color={D.primary} />}
            label="Agendamentos"
            onPress={() => navigate('AdminDashboard')}
          />
          <DrawerItem
            styles={styles}
            icon={<History size={18} color={D.primary} />}
            label="Histórico"
            onPress={() => navigate('AdminHistory')}
          />
          <DrawerItem
            styles={styles}
            icon={<Settings size={18} color={D.primary} />}
            label="Gerenciar loja"
            onPress={() => navigate('AdminManage')}
          />
          <DrawerItem
            styles={styles}
            icon={<User size={18} color={D.primary} />}
            label="Perfil"
            onPress={() => navigate('AdminProfile')}
          />
          <View style={styles.drawerDivider} />
          <DrawerItem
            styles={styles}
            icon={<LogOut size={18} color={D.accent} />}
            label="Sair"
            onPress={handleSignOut}
            danger
          />
        </View>
      </Animated.View>
      <ConfirmModal
        visible={servicesConfirmVisible}
        title="Sem servi\u00e7os cadastrados"
        message={
          'Sua est\u00e9tica ainda n\u00e3o tem servi\u00e7os cadastrados. Acesse "Gerenciamento da loja" para adicionar os servi\u00e7os que voc\u00ea oferece.'
        }
        confirmLabel="Ir para gerenciamento"
        cancelLabel="Agora n\u00e3o"
        onCancel={() => setServicesConfirmVisible(false)}
        onConfirm={() => {
          setServicesConfirmVisible(false);
          onClose();
          navigation.navigate('AdminManage');
        }}
      />
      <ConfirmModal
        visible={signOutConfirmVisible}
        title="Sair da conta"
        message="Deseja realmente sair?"
        confirmLabel="Sair"
        destructive
        onCancel={() => setSignOutConfirmVisible(false)}
        onConfirm={confirmSignOut}
      />
    </>
  );
}

function DrawerItem({
  styles,
  icon,
  label,
  onPress,
  danger,
}: {
  styles: DrawerStyles;
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.drawerItem}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {icon}
      <Text style={[styles.drawerItemText, danger && styles.drawerItemDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(D: AppColors) {
  return StyleSheet.create({
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
      paddingBottom: 24,
      borderBottomWidth: 1,
      borderBottomColor: D.border,
    },
    drawerAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: D.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    drawerAvatarText: {
      fontSize: T.size.titleLarge,
      fontFamily: T.family.extraBold,
      color: D.onPrimary,
    },
    ownerRow: {
      alignItems: 'flex-start',
      gap: 8,
      width: '100%',
    },
    drawerName: {
      width: '100%',
      fontSize: T.size.bodyLarge,
      lineHeight: T.lineHeight.bodyLarge,
      fontFamily: T.family.extraBold,
      color: D.ink,
    },
    shopBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      maxWidth: '100%',
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: D.primaryLight,
      borderWidth: 1,
      borderColor: D.borderFocus,
    },
    shopBadgeText: {
      flexShrink: 1,
      fontSize: T.size.caption,
      lineHeight: T.lineHeight.caption,
      fontFamily: T.family.bold,
      color: D.primary,
    },
    drawerMenu: { paddingTop: 8, flex: 1 },
    drawerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 20,
    },
    drawerItemText: { fontSize: 16, fontFamily: T.family.medium, color: D.ink },
    drawerItemDanger: { color: D.accent },
    drawerDivider: { height: 1, backgroundColor: D.border, marginVertical: 8 },
  });
}
