import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, typography as T, useAppTheme, type AppColors } from '@shared/theme';
import { formatUtils } from '@shared/utils/format.utils';
import type { LinhaDeCliente } from '../domain/clientes';

type Props = {
  clientes: LinhaDeCliente[];
  testID?: string;
};

/** Quem mais voltou no mês, com visitas e quanto gastou. */
export default function PodioDeClientes({ clientes, testID }: Props) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);

  return (
    <View style={styles.lista} testID={testID}>
      {clientes.map((c, i) => (
        <View key={c.clienteId} style={styles.linha}>
          <View style={[styles.posicao, i === 0 && styles.posicaoLider]}>
            <Text style={[styles.posicaoTexto, i === 0 && styles.posicaoTextoLider]}>{i + 1}</Text>
          </View>
          <Text style={styles.nome} numberOfLines={1}>
            {c.nome}
          </Text>
          <Text style={styles.visitas}>
            {c.visitas === 1 ? '1 visita' : `${c.visitas} visitas`}
          </Text>
          <Text style={styles.total}>{formatUtils.currency(c.total)}</Text>
        </View>
      ))}
    </View>
  );
}

function createStyles(D: AppColors) {
  return StyleSheet.create({
    lista: { gap: spacing.sm },
    linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    posicao: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: D.surface,
    },
    posicaoLider: { backgroundColor: D.primary },
    posicaoTexto: {
      color: D.ink2,
      fontFamily: T.family.bold,
      fontSize: T.size.caption,
    },
    posicaoTextoLider: { color: D.onPrimary },
    nome: {
      flex: 1,
      color: D.ink,
      fontFamily: T.family.medium,
      fontSize: T.size.secondary,
    },
    visitas: {
      color: D.ink2,
      fontFamily: T.family.regular,
      fontSize: T.size.caption,
    },
    total: {
      color: D.ink,
      fontFamily: T.family.bold,
      fontSize: T.size.secondary,
      minWidth: 68,
      textAlign: 'right',
    },
  });
}
