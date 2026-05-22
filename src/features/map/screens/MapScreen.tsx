import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  StatusBar,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, MapPin, Navigation, RefreshCw } from 'lucide-react-native';

import { useAppTheme, type AppColors, typography as T } from '@shared/theme';
import {
  discoverNearbyShops,
  type NearbyShop,
} from '@features/shops/services/discoverShops.service';
import ShopDetailSheet from '../components/ShopDetailSheet';

const DEFAULT_RADIUS_KM = 50;
const INITIAL_DELTA = 0.08;

export default function MapScreen() {
  const { colors: D, isLight } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const mapRef = useRef<MapView>(null);
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();

  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [shops, setShops] = useState<NearbyShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShop, setSelectedShop] = useState<NearbyShop | null>(null);

  const fetchLocation = useCallback(() => {
    setLoading(true);
    Geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setUserLat(latitude);
        setUserLng(longitude);

        discoverNearbyShops({ lat: latitude, lng: longitude }, DEFAULT_RADIUS_KM)
          .then(setShops)
          .catch(() => Alert.alert('Erro', 'Não foi possível buscar estéticas próximas.'))
          .finally(() => setLoading(false));

        mapRef.current?.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: INITIAL_DELTA,
          longitudeDelta: INITIAL_DELTA,
        });
      },
      err => {
        setLoading(false);
        if (err.code === 1) {
          Alert.alert(
            'Permissão negada',
            'Precisamos da sua localização para mostrar as estéticas próximas.',
          );
        }
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 },
    );
  }, []);

  const requestLocationAndFetch = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permissão de localização',
            message:
              'O DetailGo precisa da sua localização para mostrar as estéticas parceiras próximas de você.',
            buttonNeutral: 'Perguntar depois',
            buttonNegative: 'Não permitir',
            buttonPositive: 'Permitir',
          },
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          fetchLocation();
        } else {
          setLoading(false);
          Alert.alert(
            'Localização necessária',
            'Para ver as estéticas próximas, permita o acesso à localização nas configurações do celular.',
          );
        }
      } catch {
        setLoading(false);
      }
    } else {
      // iOS — @react-native-community/geolocation pede permissão automaticamente
      fetchLocation();
    }
  }, [fetchLocation]);

  useEffect(() => {
    requestLocationAndFetch();
  }, [requestLocationAndFetch]);

  const handleCenterUser = () => {
    if (!userLat || !userLng) return;
    mapRef.current?.animateToRegion({
      latitude: userLat,
      longitude: userLng,
      latitudeDelta: INITIAL_DELTA,
      longitudeDelta: INITIAL_DELTA,
    });
  };

  const initialRegion =
    userLat && userLng
      ? {
          latitude: userLat,
          longitude: userLng,
          latitudeDelta: INITIAL_DELTA,
          longitudeDelta: INITIAL_DELTA,
        }
      : { latitude: -23.55, longitude: -46.63, latitudeDelta: 0.5, longitudeDelta: 0.5 }; // SP fallback

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isLight ? 'dark-content' : 'light-content'}
        translucent
        backgroundColor="transparent"
      />

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {shops.map(shop => (
          <Marker
            key={shop.id}
            coordinate={{ latitude: shop.lat, longitude: shop.lng }}
            onPress={() => setSelectedShop(shop)}
          >
            <View style={[styles.pin, selectedShop?.id === shop.id && styles.pinSelected]}>
              <MapPin size={14} color="#fff" />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerCard}>
          {canGoBack && (
            <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
              <ArrowLeft size={18} color={D.ink} />
            </Pressable>
          )}
          <Text style={styles.headerTitle}>Estéticas parceiras</Text>
          {loading ? (
            <ActivityIndicator size="small" color={D.primary} />
          ) : (
            <Text style={styles.headerCount}>
              {shops.length === 0
                ? 'Nenhuma próxima'
                : `${shops.length} encontrada${shops.length > 1 ? 's' : ''}`}
            </Text>
          )}
        </View>
      </View>

      {/* Botões flutuantes */}
      <View style={styles.fab}>
        <Pressable style={styles.fabBtn} onPress={fetchLocation}>
          <RefreshCw size={18} color={D.ink} />
        </Pressable>
        <Pressable style={styles.fabBtn} onPress={handleCenterUser}>
          <Navigation size={18} color={D.primary} />
        </Pressable>
      </View>

      {/* Sheet de detalhes */}
      {selectedShop && (
        <ShopDetailSheet shop={selectedShop} onClose={() => setSelectedShop(null)} />
      )}
    </View>
  );
}

function createStyles(D: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: D.bg },
    map: { flex: 1 },

    header: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 56 : 40,
      left: 16,
      right: 16,
    },
    headerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      backgroundColor: D.card,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: D.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
    backBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: D.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 14,
      fontFamily: T.family.bold,
      color: D.ink,
    },
    headerCount: {
      fontSize: 12,
      color: D.ink2,
      fontFamily: T.family.medium,
    },

    fab: {
      position: 'absolute',
      bottom: 32,
      right: 16,
      gap: 10,
    },
    fabBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: D.card,
      borderWidth: 1,
      borderColor: D.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 4,
    },

    pin: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: D.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#fff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    pinSelected: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: D.accent,
    },
  });
}
