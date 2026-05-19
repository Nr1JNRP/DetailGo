import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { doc, getFirestore, updateDoc } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { MapPin, X, ArrowRight } from 'lucide-react-native';

import { useAppTheme, type AppColors } from '@shared/theme';
import { formatDistance } from '@shared/utils/geo.utils';
import type { NearbyShop } from '@features/shops/services/discoverShops.service';

type Props = {
  shop: NearbyShop;
  onClose: () => void;
};

export default function ShopDetailSheet({ shop, onClose }: Props) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const [loading, setLoading] = useState(false);

  const handleSelectShop = async () => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;

    setLoading(true);
    try {
      await updateDoc(doc(getFirestore(), 'users', uid), { shopId: shop.id });
      // ShopContext detecta a mudança via onSnapshot e redireciona para Dashboard
    } catch {
      Alert.alert('Erro', 'Não foi possível selecionar esta estética. Tente novamente.');
      setLoading(false);
    }
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

      {/* CTA */}
      <Pressable
        style={[styles.cta, loading && styles.ctaDisabled]}
        onPress={handleSelectShop}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.ctaText}>Agendar nesta estética</Text>
            <ArrowRight size={18} color="#fff" />
          </>
        )}
      </Pressable>
    </View>
  );
}

function createStyles(D: AppColors) {
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
      paddingBottom: 36,
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
      fontWeight: '700',
      color: D.ink,
      marginBottom: 3,
    },
    shopAddress: {
      fontSize: 13,
      color: D.ink2,
      marginBottom: 2,
    },
    distance: {
      fontSize: 12,
      fontWeight: '600',
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
    ctaDisabled: { opacity: 0.5 },
    ctaText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
  });
}
