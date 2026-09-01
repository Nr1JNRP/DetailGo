/* eslint-env node, jest */
/**
 * Setup global dos testes. Mocka módulos nativos que não existem no ambiente
 * Node do Jest (equivalente a "não ter device"). Cada teste ainda mocka o que é
 * específico dele (services, navigation).
 */

// AsyncStorage (usado pela persistência do tema no useThemeStore)
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Safe area — insets fixos + providers como View simples
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  // Os contexts também: o React Navigation lê direto deles em vez dos hooks,
  // e sem isto qualquer teste que monte um navegador quebra no useContext.
  return {
    __esModule: true,
    SafeAreaProvider: ({ children }) => React.createElement(View, null, children),
    SafeAreaView: ({ children, ...props }) => React.createElement(View, props, children),
    SafeAreaInsetsContext: React.createContext(inset),
    SafeAreaFrameContext: React.createContext(frame),
    initialWindowMetrics: { insets: inset, frame },
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => frame,
  };
});

// LinearGradient vira uma View simples
jest.mock('react-native-linear-gradient', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});

// Ícones lucide viram componentes vazios (não renderizam SVG nativo nos testes)
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

// Bootsplash
jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn().mockResolvedValue(undefined),
  isVisible: jest.fn().mockResolvedValue(false),
}));

// Crashlytics — API modular vira no-op (não há módulo nativo no Jest)
jest.mock('@react-native-firebase/crashlytics', () => ({
  getCrashlytics: jest.fn(() => ({})),
  setCrashlyticsCollectionEnabled: jest.fn(),
  setUserId: jest.fn(),
  recordError: jest.fn(),
  log: jest.fn(),
  crash: jest.fn(),
}));
