import React, { useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar, History, LogOut, Settings, Store, User } from 'lucide-react-native';
import { getAuth } from '@react-native-firebase/auth';
import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';

import { darkColors as D } from '@shared/theme';
import { UI } from '@shared/constants/app.constants';
import { useShop } from '@features/shops';
import type { RootStackParamList } from '@app/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  visible: boolean;
  slideAnim: Animated.Value;
  onClose: () => void;
};

export default function AdminDrawer({ visible, slideAnim, onClose }: Props) {
  const navigation = useNavigation<Nav>();
  const { shop } = useShop();
  const auth = getAuth();
  const user = auth.currentUser;
  const db = getFirestore();

  const [photoB64, setPhotoB64] = useState<string | null>(null);

  // Carrega foto do Firestore em tempo real
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), snap => {
      const data = snap.data() as { photoB64?: string } | undefined;
      setPhotoB64(data?.photoB64 ?? null);
    });
    return () => unsub();
  }, [user?.uid, db]);

  const shopName = shop?.name ?? 'Minha estética';
  const ownerName = user?.displayName ?? 'Proprietário';
  const email = user?.email ?? '';

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
    Alert.alert('Sair da conta', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          try {
            onClose();
            await auth.signOut();
          } catch {
            Alert.alert('Erro', 'Falha ao sair da conta.');
          }
        },
      },
    ]);
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
          <Text style={styles.drawerName}>{ownerName}</Text>
          <View style={styles.emailRow}>
            <Text style={styles.drawerEmail} numberOfLines={1}>
              {email}
            </Text>
            <View style={styles.shopBadge}>
              <Store size={10} color={D.primary} />
              <Text style={styles.shopBadgeText}>{shopName}</Text>
            </View>
          </View>
        </View>

        {/* ── Navegação ── */}
        <View style={styles.drawerMenu}>
          <DrawerItem
            icon={<Calendar size={18} color={D.primary} />}
            label="Agendamentos"
            onPress={() => navigate('AdminDashboard')}
          />
          <DrawerItem
            icon={<History size={18} color={D.primary} />}
            label="Histórico"
            onPress={() => navigate('AdminHistory')}
          />
          <DrawerItem
            icon={<Settings size={18} color={D.primary} />}
            label="Gerenciar loja"
            onPress={() => navigate('AdminManage')}
          />
          <DrawerItem
            icon={<User size={18} color={D.primary} />}
            label="Perfil"
            onPress={() => navigate('AdminProfile')}
          />
          <View style={styles.drawerDivider} />
          <DrawerItem
            icon={<LogOut size={18} color={D.accent} />}
            label="Sair"
            onPress={handleSignOut}
            danger
          />
        </View>
      </Animated.View>
    </>
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

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
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
  drawerAvatarText: { fontSize: 18, fontWeight: '700', color: '#0B0D0E' },
  drawerName: { fontSize: 16, fontWeight: '700', color: D.ink, marginBottom: 4 },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  drawerEmail: { fontSize: 14, color: D.ink3, flexShrink: 1 },
  shopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: D.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(212,255,61,0.2)',
  },
  shopBadgeText: { fontSize: 11, fontWeight: '700', color: D.primary },
  drawerMenu: { paddingTop: 8, flex: 1 },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  drawerItemText: { fontSize: 16, fontWeight: '500', color: D.ink },
  drawerItemDanger: { color: D.accent },
  drawerDivider: { height: 1, backgroundColor: D.border, marginVertical: 8 },
});
