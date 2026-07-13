import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';

import { typography as T, useAppTheme, type AppColors } from '@shared/theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
};

/**
 * Modal de sucesso na identidade do app (card escuro + check neon com "pop"),
 * substituindo o Alert.alert nativo. Entrada animada: backdrop em fade + card
 * com mola (scale) + ícone de check estourando. Usa o Animated nativo do RN.
 */
export default function SuccessModal({ visible, title, message, primaryLabel, onPrimary }: Props) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);

  const backdrop = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      backdrop.setValue(0);
      card.setValue(0);
      check.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(card, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
    ]).start();
    Animated.spring(check, {
      toValue: 1,
      delay: 120,
      friction: 5,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [visible, backdrop, card, check]);

  const cardScale = card.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const checkScale = check.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Modal visible={visible} transparent statusBarTranslucent onRequestClose={onPrimary}>
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <Animated.View style={[styles.card, { opacity: card, transform: [{ scale: cardScale }] }]}>
          <Animated.View style={[styles.checkWrap, { transform: [{ scale: checkScale }] }]}>
            <CheckCircle2 size={34} color={D.primary} strokeWidth={2.4} />
          </Animated.View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={onPrimary} activeOpacity={0.85}>
            <Text style={styles.buttonText}>{primaryLabel}</Text>
          </TouchableOpacity>
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
    checkWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: D.primaryLight,
      borderWidth: 1.5,
      borderColor: D.primary,
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
    button: {
      alignSelf: 'stretch',
      minHeight: 50,
      borderRadius: 14,
      backgroundColor: D.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      fontSize: T.size.body,
      fontFamily: T.family.bold,
      color: D.onPrimary,
    },
  });
}
