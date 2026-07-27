import {
  getCrashlytics,
  setCrashlyticsCollectionEnabled,
  setUserId,
  recordError,
  log,
} from '@react-native-firebase/crashlytics';

// getCrashlytics() é chamado dentro de cada função (lazy) para não tocar o
// módulo nativo no momento do import — mantém os testes de unidade do app
// livres do Crashlytics e evita ordem de init frágil.

/**
 * Liga a coleta apenas em build de produção (release). Em desenvolvimento
 * (`__DEV__`, rodando via Metro) fica desligado para não poluir o painel com
 * crashes de dev.
 */
export function initCrashlytics(): void {
  setCrashlyticsCollectionEnabled(getCrashlytics(), !__DEV__);
}

/** Amarra os próximos relatórios a um usuário — só o uid, sem PII. */
export function setCrashUser(uid: string): void {
  setUserId(getCrashlytics(), uid);
}

/** Limpa o usuário associado (logout). */
export function clearCrashUser(): void {
  setUserId(getCrashlytics(), '');
}

/**
 * Registra um erro tratado (não-fatal). Use em catches onde você quer
 * visibilidade sem derrubar o app. `context` vira uma pista (breadcrumb).
 */
export function reportError(error: unknown, context?: string): void {
  const crashlytics = getCrashlytics();
  if (context) {
    log(crashlytics, context);
  }
  recordError(crashlytics, error instanceof Error ? error : new Error(String(error)));
}
