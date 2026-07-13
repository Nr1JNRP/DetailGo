import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type ViewStyle, type StyleProp } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

type Props = {
  children: React.ReactNode;
  /** Atraso antes de animar, em ms (use p/ escalonar blocos em cascata). */
  delay?: number;
  /** Distância inicial do deslize vertical, em px. */
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Entrada suave: fade + slide de baixo pra cima + leve scale ao aparecer. Usa o
 * Animated nativo do RN (useNativeDriver), sem dependência externa. Reanima toda
 * vez que a tela ganha foco, então dá pra ver o efeito ao voltar pra ela.
 */
export function FadeInUp({ children, delay = 0, distance = 26, duration = 440, style }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) {
      progress.setValue(0);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [isFocused, delay, duration, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}
