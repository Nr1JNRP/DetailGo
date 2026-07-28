import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import SuccessModal from '@shared/components/SuccessModal';
import ErrorModal from '@shared/components/ErrorModal';
import ConfirmModal from '@shared/components/ConfirmModal';

type ShowOptions = {
  /** Título do card (padrão: "Tudo certo!" no sucesso, "Ops" no erro). */
  title?: string;
  /** Label do botão (padrão: "OK" / "Entendi"). */
  primaryLabel?: string;
  /** Callback disparado ao fechar (ex.: navegar depois do OK). */
  onClose?: () => void;
};

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Ação perigosa (ex.: excluir) — botão de confirmar em vermelho. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

type FeedbackContextValue = {
  showSuccess: (message: string, options?: ShowOptions) => void;
  showError: (message: string, options?: ShowOptions) => void;
  showConfirm: (options: ConfirmOptions) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

type DialogState =
  | ({ kind: 'success' | 'error'; title: string; message: string; primaryLabel: string } & {
      onClose?: () => void;
    })
  | ({ kind: 'confirm' } & ConfirmOptions)
  | null;

/**
 * Provider global de feedback. Expõe showSuccess/showError/showConfirm via
 * useFeedback() e renderiza os modais na identidade do app uma única vez —
 * elimina o Alert.alert nativo e o boilerplate de estado em cada tela.
 */
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const close = useCallback(() => setDialog(null), []);

  const showSuccess = useCallback((message: string, options?: ShowOptions) => {
    setDialog({
      kind: 'success',
      title: options?.title ?? 'Tudo certo!',
      message,
      primaryLabel: options?.primaryLabel ?? 'OK',
      onClose: options?.onClose,
    });
  }, []);

  const showError = useCallback((message: string, options?: ShowOptions) => {
    setDialog({
      kind: 'error',
      title: options?.title ?? 'Ops',
      message,
      primaryLabel: options?.primaryLabel ?? 'Entendi',
      onClose: options?.onClose,
    });
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions) => {
    setDialog({ kind: 'confirm', ...options });
  }, []);

  const value = useMemo(
    () => ({ showSuccess, showError, showConfirm }),
    [showSuccess, showError, showConfirm],
  );

  const handleFeedbackClose = () => {
    const onClose = dialog && dialog.kind !== 'confirm' ? dialog.onClose : undefined;
    close();
    onClose?.();
  };

  const handleConfirm = () => {
    const onConfirm = dialog?.kind === 'confirm' ? dialog.onConfirm : undefined;
    close();
    onConfirm?.();
  };

  const handleCancel = () => {
    const onCancel = dialog?.kind === 'confirm' ? dialog.onCancel : undefined;
    close();
    onCancel?.();
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <SuccessModal
        visible={dialog?.kind === 'success'}
        title={dialog?.kind === 'success' ? dialog.title : ''}
        message={dialog?.kind === 'success' ? dialog.message : ''}
        primaryLabel={dialog?.kind === 'success' ? dialog.primaryLabel : 'OK'}
        onPrimary={handleFeedbackClose}
      />

      <ErrorModal
        visible={dialog?.kind === 'error'}
        title={dialog?.kind === 'error' ? dialog.title : ''}
        message={dialog?.kind === 'error' ? dialog.message : ''}
        primaryLabel={dialog?.kind === 'error' ? dialog.primaryLabel : 'Entendi'}
        onPrimary={handleFeedbackClose}
      />

      <ConfirmModal
        visible={dialog?.kind === 'confirm'}
        title={dialog?.kind === 'confirm' ? dialog.title : ''}
        message={dialog?.kind === 'confirm' ? dialog.message : ''}
        confirmLabel={dialog?.kind === 'confirm' ? dialog.confirmLabel : 'Confirmar'}
        cancelLabel={dialog?.kind === 'confirm' ? dialog.cancelLabel : undefined}
        destructive={dialog?.kind === 'confirm' ? dialog.destructive : false}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error('useFeedback deve ser usado dentro de <FeedbackProvider>');
  }
  return ctx;
}
