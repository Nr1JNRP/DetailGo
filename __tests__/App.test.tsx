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

jest.mock('@shared/theme', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  darkColors: {
    accent: '#FF5C39',
    ink: '#F5F7F8',
    ink2: '#A8B0B4',
    primary: '#D4FF3D',
  },
  typography: {
    family: {
      medium: 'sans-serif-medium',
    },
  },
}));

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
