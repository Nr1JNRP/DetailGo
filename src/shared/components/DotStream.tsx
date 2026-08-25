import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, View } from 'react-native';

import { useAppTheme } from '@shared/theme';

type Props = {
  /** Cor dos pontos. Padrão: neon primário do tema. */
  color?: string;
  /** Diâmetro de cada ponto em repouso, em px. */
  size?: number;
  /** Espaço entre os pontos, em px. Padrão: o próprio tamanho do ponto. */
  gap?: number;
  /** Quantidade de pontos na fileira. Três cabem na pílula sem empurrar o texto. */
  count?: number;
  /** Duração de um ciclo completo da onda, em ms. */
  duration?: number;
};

/**
 * Fileira de pontos com uma onda que percorre da esquerda para a direita, em
 * loop — indica trabalho em andamento (inspirado no "dot stream" do ldrs, que
 * é web e não roda aqui; refeito com o Animated nativo do RN).
 *
 * Cada ponto tem seu próprio valor animado, defasado no tempo. Só escala e
 * opacidade são animadas, então tudo roda com useNativeDriver.
 */
export function DotStream({ color, size = 4, gap, count = 3, duration = 1100 }: Props) {
  const { colors: D } = useAppTheme();
  const dotColor = color ?? D.primary;
  const espaco = gap ?? size;

  // Um valor por ponto. O array é criado uma vez: recriá-lo a cada render
  // reiniciaria a animação e quebraria a defasagem entre os pontos.
  const valores = useRef<Animated.Value[]>([]);
  if (valores.current.length !== count) {
    valores.current = Array.from({ length: count }, () => new Animated.Value(0));
  }

  useEffect(() => {
    const pontos = valores.current;
    // O ciclo se divide entre os pontos: cada um sobe e desce enquanto os
    // outros esperam sua vez, formando a onda.
    const passo = duration / (pontos.length + 1);

    const animacoes = pontos.map((valor, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * passo),
          Animated.timing(valor, { toValue: 1, duration: passo, useNativeDriver: true }),
          Animated.timing(valor, { toValue: 0, duration: passo, useNativeDriver: true }),
          Animated.delay((pontos.length - 1 - i) * passo),
        ]),
      ),
    );

    animacoes.forEach(a => a.start());
    return () => animacoes.forEach(a => a.stop());
  }, [count, duration]);

  const estiloPonto = useMemo(
    () => ({ width: size, height: size, borderRadius: size / 2, backgroundColor: dotColor }),
    [dotColor, size],
  );

  return (
    // Decorativo: não deve capturar toque do card que o contém.
    <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center' }}>
      {valores.current.map((valor, i) => (
        <Animated.View
          key={i}
          style={[
            estiloPonto,
            i > 0 && { marginLeft: espaco },
            {
              opacity: valor.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [
                { scale: valor.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.5] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}
