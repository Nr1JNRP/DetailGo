import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, typography as T, useAppTheme, type AppColors } from '@shared/theme';
import { escalaDaPrimaria } from '../domain/paleta';

export type Barra = {
  rotulo: string;
  /** Define o comprimento da barra. */
  valor: number;
  /** O que aparece à direita: "R$ 1.080" ou "9". */
  texto: string;
};

type Props = {
  barras: Barra[];
  testID?: string;
};

/**
 * Lista de barras horizontais, cada rótulo na própria linha.
 *
 * Horizontal de propósito: nome de serviço não cabe embaixo de barra vertical,
 * e cortar "Descontaminação de Pintura" com reticências transforma o gráfico
 * em adivinhação. Aqui o nome tem a largura toda.
 *
 * A maior barra é sempre 100% e as outras são relativas a ela, não ao total:
 * o que interessa é comparar as fatias entre si.
 */
export default function BarrasProporcionais({ barras, testID }: Props) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);

  const maior = Math.max(...barras.map(b => b.valor), 0);
  const tons = useMemo(
    () => escalaDaPrimaria(D.primary, barras.length),
    [D.primary, barras.length],
  );

  return (
    <View style={styles.lista} testID={testID}>
      {barras.map((barra, i) => (
        <View key={barra.rotulo}>
          <View style={styles.cabecalho}>
            <Text style={styles.rotulo} numberOfLines={1}>
              {barra.rotulo}
            </Text>
            <Text style={styles.texto}>{barra.texto}</Text>
          </View>
          <View style={styles.trilho}>
            <View
              style={[
                styles.preenchimento,
                {
                  // Sem serviço nenhum o denominador seria zero; a barra some.
                  width: maior > 0 ? `${Math.max((barra.valor / maior) * 100, 2)}%` : '0%',
                  backgroundColor: tons[i],
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function createStyles(D: AppColors) {
  return StyleSheet.create({
    lista: { gap: spacing.sm },
    cabecalho: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: 4,
    },
    rotulo: {
      flex: 1,
      color: D.ink,
      fontFamily: T.family.medium,
      fontSize: T.size.secondary,
    },
    texto: {
      color: D.ink2,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
    },
    trilho: {
      height: 8,
      borderRadius: 4,
      backgroundColor: D.surface,
      overflow: 'hidden',
    },
    preenchimento: { height: 8, borderRadius: 4 },
  });
}
