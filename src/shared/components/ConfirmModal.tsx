import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, HelpCircle } from 'lucide-react-native';

import { typography as T, useAppTheme, type AppColors } from '@shared/theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Ação perigosa (ex.: excluir): destaca o botão de confirmar em vermelho. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Modal de confirmação (2 botões) na identidade do app, substituindo o
 * Alert.alert nativo de "tem certeza?". Mesma entrada animada do SuccessModal.
 */
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const accent = destructive ? D.status.error : D.primary;

  const backdrop = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      backdrop.setValue(0);
      card.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(card, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [visible, backdrop, card]);

  const cardScale = card.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const Icon = destructive ? AlertTriangle : HelpCircle;

  return (
    <Modal visible={visible} transparent statusBarTranslucent onRequestClose={onCancel}>
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <Animated.View style={[styles.card, { opacity: card, transform: [{ scale: cardScale }] }]}>
          <View style={[styles.iconWrap, { backgroundColor: accent + '22', borderColor: accent }]}>
            <Icon size={30} color={accent} strokeWidth={2.3} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: accent }]}
              onPress={onConfirm}
              activeOpacity={0.85}
            >
              <Text style={[styles.confirmText, destructive && styles.confirmTextOnError]}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function createStyles(D: AppColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: D.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: D.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: D.border,
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 22,
    },
    iconWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: T.size.titleLarge,
      lineHeight: T.lineHeight.titleLarge,
      fontFamily: T.family.extraBold,
      color: D.ink,
      textAlign: 'center',
    },
    message: {
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      fontFamily: T.family.medium,
      color: D.ink2,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 22,
    },
    actions: {
      flexDirection: 'row',
      alignSelf: 'stretch',
      gap: 12,
    },
    cancelBtn: {
      flex: 1,
      minHeight: 50,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: D.borderStrong,
      backgroundColor: D.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: {
      fontSize: T.size.body,
      fontFamily: T.family.bold,
      color: D.ink,
    },
    confirmBtn: {
      flex: 1,
      minHeight: 50,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmText: {
      fontSize: T.size.body,
      fontFamily: T.family.bold,
      color: D.onPrimary,
    },
    confirmTextOnError: {
      color: '#FFFFFF',
    },
  });
}
