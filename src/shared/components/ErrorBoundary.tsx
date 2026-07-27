import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';

import { useAppTheme, type AppColors, typography as T } from '@shared/theme';
import { reportError } from '@shared/services/crashlytics.service';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

/**
 * Tela de fallback exibida quando um erro de renderização é capturado. Fica em
 * um componente funcional próprio para poder usar o tema (hooks) — a
 * ErrorBoundary em si precisa ser classe.
 */
function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { colors: D } = useAppTheme();
  const styles = React.useMemo(() => createStyles(D), [D]);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <AlertTriangle size={40} color={D.accent} />
      </View>
      <Text style={styles.title}>Algo deu errado</Text>
      <Text style={styles.subtitle}>
        Tivemos um problema inesperado. Você pode tentar novamente.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={onRetry} activeOpacity={0.85}>
        <RefreshCw size={18} color={D.onPrimary} />
        <Text style={styles.btnText}>Tentar novamente</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Captura erros de renderização em toda a árvore, reporta ao Crashlytics e
 * mostra uma tela de erro na identidade do app — em vez da tela branca.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const stack = info.componentStack?.slice(0, 300) ?? '';
    reportError(error, `ErrorBoundary${stack ? `: ${stack}` : ''}`);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

function createStyles(D: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: D.bg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    iconWrap: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: D.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: D.border,
      marginBottom: 24,
    },
    title: {
      fontSize: 22,
      fontFamily: T.family.bold,
      color: D.ink,
      marginBottom: 10,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      fontFamily: T.family.regular,
      color: D.ink2,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 32,
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 54,
      paddingHorizontal: 28,
      borderRadius: 16,
      backgroundColor: D.primary,
    },
    btnText: {
      fontSize: 16,
      fontFamily: T.family.bold,
      color: D.onPrimary,
    },
  });
}
