/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('@features/auth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: null, initializing: false }),
}));

jest.mock('@features/shops/context/ShopContext', () => ({
  ShopProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useShop: () => ({ loading: false }),
}));

jest.mock('@shared/theme', () => {
  const palette = {
    bg: '#0B0D0E',
    surface: '#121517',
    card: '#191D20',
    accent: '#FF5C39',
    ink: '#F5F7F8',
    ink2: '#A8B0B4',
    ink3: '#6B7378',
    primary: '#D4FF3D',
    primaryLight: 'rgba(212,255,61,0.12)',
    onPrimary: '#050708',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.15)',
    overlay: 'rgba(0,0,0,0.65)',
    status: { success: '#22C55E', error: '#FF5C39', warning: '#F59E0B', info: '#3B82F6' },
  };
  const typography = {
    family: {
      regular: 'sans-serif',
      medium: 'sans-serif-medium',
      semiBold: 'sans-serif-semibold',
      bold: 'sans-serif-bold',
      extraBold: 'sans-serif-extrabold',
    },
    size: { caption: 12, secondary: 13, body: 15, bodyLarge: 17, title: 20, titleLarge: 24 },
    lineHeight: { caption: 16, secondary: 18, body: 22, bodyLarge: 24, title: 26, titleLarge: 30 },
  };
  return {
    ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useAppTheme: () => ({ colors: palette, isLight: false }),
    darkColors: palette,
    typography,
  };
});

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@features/notifications', () => ({
  useForegroundNotifications: jest.fn(),
}));

jest.mock('../src/navigation/RootNavigator', () => () => null);

import App from '../App';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('renders correctly', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});
