import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, X, ArrowRight } from 'lucide-react-native';

import type { RootStackParamList } from '@app/types';
import { useAppTheme, type AppColors, typography as T } from '@shared/theme';
import { formatDistance } from '@shared/utils/geo.utils';
import type { NearbyShop } from '@features/shops/services/discoverShops.service';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  shop: NearbyShop;
  onClose: () => void;
};

export default function ShopDetailSheet({ shop, onClose }: Props) {
  const { colors: D } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 42 : 16);
  const styles = useMemo(() => createStyles(D, bottomInset), [D, bottomInset]);
  const navigation = useNavigation<Nav>();

  const handleOpenProfile = () => {
    onClose();
    navigation.navigate('ShopProfile', { shopId: shop.id });
  };

  return (
    <View style={styles.sheet}>
      {/* Fechar */}
      <Pressable style={styles.closeBtn} onPress={onClose}>
        <X size={16} color={D.ink2} />
      </Pressable>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.iconWrap}>
          <MapPin size={20} color={D.primary} />
        </View>
        <View style={styles.texts}>
          <Text style={styles.shopName}>{shop.name}</Text>
          <Text style={styles.shopAddress} numberOfLines={1}>
            {shop.address || shop.city}
          </Text>
          <Text style={styles.distance}>{formatDistance(shop.distanceKm)} de você</Text>
        </View>
      </View>

      {/* CTA — leva para a tela de perfil completo do shop */}
      <Pressable style={styles.cta} onPress={handleOpenProfile}>
        <Text style={styles.ctaText}>Ver detalhes da estética</Text>
        <ArrowRight size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

function createStyles(D: AppColors, bottomInset: number) {
  return StyleSheet.create({
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: D.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 24 + bottomInset,
      borderWidth: 1,
      borderColor: D.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 12,
    },
    closeBtn: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: D.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 20,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: D.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    texts: { flex: 1 },
    shopName: {
      fontSize: 17,
      fontFamily: T.family.bold,
      color: D.ink,
      marginBottom: 3,
    },
    shopAddress: {
      fontSize: 13,
      fontFamily: T.family.regular,
      color: D.ink2,
      marginBottom: 2,
    },
    distance: {
      fontSize: 12,
      fontFamily: T.family.semiBold,
      color: D.primary,
    },
    cta: {
      height: 52,
      borderRadius: 14,
      backgroundColor: D.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
    },
    ctaText: {
      fontSize: 15,
      fontFamily: T.family.bold,
      color: '#fff',
    },
  });
}
