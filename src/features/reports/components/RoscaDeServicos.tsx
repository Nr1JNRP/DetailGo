import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { spacing, typography as T, useAppTheme, type AppColors } from '@shared/theme';
import { escalaDaPrimaria } from '../domain/paleta';
import type { LinhaDeServico } from '../domain/serviceReport';

type Props = {
  linhas: LinhaDeServico[];
  total: number;
};

/**
 * Rosca dos serviços com a legenda ao lado.
 *
 * A legenda existe para o nome caber inteiro: dentro da fatia ou num eixo, um
 * nome como "Higienização de Bancos" só cabe truncado. Aqui a fatia carrega a
 * cor e a legenda carrega o nome e a porcentagem.
 *
 * O total vive no buraco do meio, onde a rosca deixa espaço de graça.
 */
export default function RoscaDeServicos({ linhas, total }: Props) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);

  const tons = useMemo(
    () => escalaDaPrimaria(D.primary, linhas.length),
    [D.primary, linhas.length],
  );

  const fatias = useMemo(
    () => linhas.map((l, i) => ({ value: l.quantidade, color: tons[i] })),
    [linhas, tons],
  );

  return (
    <View style={styles.linha}>
      <PieChart
        data={fatias}
        donut
        radius={54}
        innerRadius={36}
        innerCircleColor={D.card}
        // A lib só aceita o miolo como fábrica de componente. É um rótulo sem
        // estado, nada que o remonte possa destruir.
        // eslint-disable-next-line react/no-unstable-nested-components
        centerLabelComponent={() => (
          <View style={styles.centro}>
            <Text style={styles.centroNumero}>{total}</Text>
            <Text style={styles.centroTexto}>{total === 1 ? 'serviço' : 'serviços'}</Text>
          </View>
        )}
      />

      <View style={styles.legenda}>
        {linhas.map((l, i) => (
          <View key={l.servico} style={styles.itemDaLegenda}>
            <View style={[styles.marcador, { backgroundColor: tons[i] }]} />
            <Text style={styles.nome} numberOfLines={1}>
              {l.servico}
            </Text>
            <Text style={styles.percentual}>
              {total > 0 ? `${Math.round((l.quantidade / total) * 100)}%` : '0%'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function createStyles(D: AppColors) {
  return StyleSheet.create({
    linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    centro: { alignItems: 'center' },
    centroNumero: {
      color: D.ink,
      fontFamily: T.family.extraBold,
      fontSize: T.size.bodyLarge,
    },
    centroTexto: {
      color: D.ink3,
      fontFamily: T.family.regular,
      fontSize: T.size.caption,
    },
    legenda: { flex: 1, gap: 6 },
    itemDaLegenda: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    marcador: { width: 8, height: 8, borderRadius: 2 },
    nome: {
      flex: 1,
      color: D.ink,
      fontFamily: T.family.regular,
      fontSize: T.size.caption,
    },
    percentual: {
      color: D.ink2,
      fontFamily: T.family.bold,
      fontSize: T.size.caption,
    },
  });
}
