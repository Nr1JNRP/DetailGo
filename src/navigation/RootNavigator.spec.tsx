import React from 'react';

// Cada tela vira um marcador. O que está sob teste é qual delas o navegador
// escolhe quando o estado de assinatura muda, não o conteúdo de nenhuma.
function mockStub(nome: string) {
  const { Text } = require('react-native');
  const Componente = () => <Text>{nome}</Text>;
  Componente.displayName = nome;
  return Componente;
}

const mockAuth = { user: { uid: 'owner-1' } as { uid: string } | null, initializing: false };
jest.mock('@features/auth', () => ({
  useAuth: () => mockAuth,
  LoginScreen: mockStub('tela-login'),
  RegisterScreen: mockStub('tela-register'),
}));

jest.mock('@features/subscription', () => ({
  SubscriptionScreen: mockStub('tela-assinar'),
  SubscriptionDetailScreen: mockStub('tela-detalhe-assinatura'),
}));

const mockShop = {
  userRole: 'owner' as 'owner' | 'customer' | null,
  loading: false,
  isSubscriptionActive: false,
};
jest.mock('@features/shops', () => ({
  useShop: () => mockShop,
  ShopProfileScreen: mockStub('tela-shop-profile'),
}));

jest.mock('@features/map', () => ({ MapScreen: mockStub('tela-map') }));
jest.mock('@features/dashboard', () => ({ DashboardScreen: mockStub('tela-dashboard') }));
jest.mock('@features/appointments', () => ({
  AppointmentScreen: mockStub('tela-appointment'),
  MyAppointmentsScreen: mockStub('tela-my-appointments'),
  HistoryScreen: mockStub('tela-history'),
}));
jest.mock('@features/admin', () => ({
  AdminDashboardScreen: mockStub('tela-admin-dashboard'),
  AdminManageScreen: mockStub('tela-admin-manage'),
  AdminHistoryScreen: mockStub('tela-admin-history'),
}));
jest.mock('@features/notifications', () => ({
  NotificationsScreen: mockStub('tela-admin-notifications'),
  CustomerNotificationsScreen: mockStub('tela-notifications'),
}));
jest.mock('@features/profile', () => ({ ProfileScreen: mockStub('tela-profile') }));

import { render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';

import RootNavigator from './RootNavigator';

function renderizar() {
  return render(
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>,
  );
}

describe('RootNavigator', () => {
  beforeEach(() => {
    mockAuth.user = { uid: 'owner-1' };
    mockAuth.initializing = false;
    mockShop.userRole = 'owner';
    mockShop.loading = false;
    mockShop.isSubscriptionActive = false;
  });

  it('prende o dono sem assinatura na tela de assinar', () => {
    renderizar();

    expect(screen.getByText('tela-assinar')).toBeTruthy();
  });

  // O webhook confirma o pagamento, o listener do shop atualiza e a troca de
  // grupo tem de tirar o dono da tela de pagamento. Se algum nome de rota for
  // igual nos dois grupos, o React Navigation preserva a rota atual e o dono
  // fica presoS na tela de assinar mesmo tendo pago.
  it('leva o dono para o painel assim que a assinatura fica ativa', () => {
    const { rerender } = renderizar();

    expect(screen.getByText('tela-assinar')).toBeTruthy();

    mockShop.isSubscriptionActive = true;
    rerender(
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>,
    );

    expect(screen.getByText('tela-admin-dashboard')).toBeTruthy();
    expect(screen.queryByText('tela-assinar')).toBeNull();
  });

  it('manda o cliente para o dashboard dele', () => {
    mockShop.userRole = 'customer';

    renderizar();

    expect(screen.getByText('tela-dashboard')).toBeTruthy();
  });

  it('manda quem não está logado para o login', () => {
    mockAuth.user = null;

    renderizar();

    expect(screen.getByText('tela-login')).toBeTruthy();
  });
});
