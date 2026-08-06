import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@shared/theme';

type Props = {
  /** Cor do ponto e do halo. Padrão: neon primário do tema. */
  color?: string;
  /** Diâmetro do ponto sólido, em px. */
  size?: number;
};

/**
 * Ponto "ao vivo" para status em andamento: um ponto sólido com um halo que
 * expande e some em loop (efeito radar/ping). Usa só o Animated nativo do RN
 * (useNativeDriver) — sem lib de animação, alinhado ao "neon glow com
 * parcimônia" da identidade Garage Dark.
 */
export function LiveDot({ color, size = 9 }: Props) {
  const { colors: D } = useAppTheme();
  const dotColor = color ?? D.primary;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {/* Halo que expande e some (não captura toque, é só decorativo). */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: size / 2, backgroundColor: dotColor, transform: [{ scale }], opacity },
        ]}
      />
      {/* Ponto sólido no centro. */}
      <View
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: dotColor }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
