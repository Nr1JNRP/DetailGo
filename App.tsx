import React, { useEffect, useState } from 'react';
import { Text, TextInput } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from '@features/auth';
import { ShopProvider, useShop } from '@features/shops/context/ShopContext';
import { useForegroundNotifications } from '@features/notifications';
import { ThemeProvider, typography } from '@shared/theme';
import ErrorBoundary from '@shared/components/ErrorBoundary';
import { initCrashlytics, setCrashUser, clearCrashUser } from '@shared/services/crashlytics.service';
import BootSplash from 'react-native-bootsplash';
import RootNavigator from './src/navigation/RootNavigator';

const defaultTextProps = {
  style: {
    fontFamily: typography.family.regular,
  },
};

(Text as any).defaultProps = {
  ...(Text as any).defaultProps,
  style: [(Text as any).defaultProps?.style, defaultTextProps.style],
};

(TextInput as any).defaultProps = {
  ...(TextInput as any).defaultProps,
  style: [(TextInput as any).defaultProps?.style, defaultTextProps.style],
};

function AppContent() {
  const { user, initializing } = useAuth();
  const { loading: loadingShop } = useShop();
  const [minimumSplashDone, setMinimumSplashDone] = useState(false);

  // Handler global de notificações em foreground (exibe push via notifee
  // independente da tela/conta ativa).
  useForegroundNotifications();

  // Liga o Crashlytics uma vez (coleta só em release; ver o service).
  useEffect(() => {
    initCrashlytics();
  }, []);

  // Amarra os crashes ao usuário logado (só o uid) e limpa no logout.
  useEffect(() => {
    if (user?.uid) {
      setCrashUser(user.uid);
    } else {
      clearCrashUser();
    }
  }, [user?.uid]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinimumSplashDone(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const appReady = minimumSplashDone && !initializing && !(user && loadingShop);

  useEffect(() => {
    if (appReady) {
      BootSplash.hide({ fade: true });
    }
  }, [appReady]);

  if (!appReady) {
    return null;
  }

  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <ShopProvider>
            <AppContent />
          </ShopProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
