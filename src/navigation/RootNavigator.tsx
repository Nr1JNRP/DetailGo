import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';

import type { RootStackParamList } from '@app/types';

import { useAuth, LoginScreen, RegisterScreen } from '@features/auth';
import { SubscriptionScreen } from '@features/subscription';
import { MapScreen } from '@features/map';
import { DashboardScreen } from '@features/dashboard';
import { AppointmentScreen, MyAppointmentsScreen, HistoryScreen } from '@features/appointments';
import { AdminDashboardScreen, AdminManageScreen, AdminHistoryScreen } from '@features/admin';
import { NotificationsScreen } from '@features/notifications';
import { ProfileScreen } from '@features/profile';
import { useShop, ShopProfileScreen } from '@features/shops';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, initializing } = useAuth();
  const { userRole, loading: loadingShop, isSubscriptionActive } = useShop();

  // Aguarda tanto o loading do shop quanto a resolução do role para evitar
  // flicker entre stacks (ex: stack de cliente piscando antes do owner carregar)
  if (initializing || (user && (loadingShop || userRole === null))) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  const isOwner = userRole === 'owner';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        isOwner ? (
          isSubscriptionActive ? (
            // Owner com trial/assinatura ativa → painel completo
            <Stack.Group>
              <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
              <Stack.Screen name="AdminManage" component={AdminManageScreen} />
              <Stack.Screen name="AdminHistory" component={AdminHistoryScreen} />
              <Stack.Screen name="AdminProfile" component={ProfileScreen} />
              <Stack.Screen name="AdminNotifications" component={NotificationsScreen} />
            </Stack.Group>
          ) : (
            // Owner sem assinatura → tela de pagamento
            <Stack.Group>
              <Stack.Screen name="Subscription" component={SubscriptionScreen} />
            </Stack.Group>
          )
        ) : (
          // Cliente → sempre acessa o Dashboard + todas as telas
          <Stack.Group>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Appointment" component={AppointmentScreen} />
            <Stack.Screen name="MyAppointments" component={MyAppointmentsScreen} />
            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Map" component={MapScreen} />
            <Stack.Screen name="ShopProfile" component={ShopProfileScreen} />
          </Stack.Group>
        )
      ) : (
        <Stack.Group>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
