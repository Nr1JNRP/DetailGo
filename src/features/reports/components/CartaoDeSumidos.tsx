import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography as T, useAppTheme, type AppColors } from '@shared/theme';
import { dateUtils } from '@shared/utils/date.utils';
import type { ClienteSumido } from '../domain/recorrencia';

type Props = {
  sumidos: ClienteSumido[];
  diasLimite: number;
};

/**
 * Quem já foi cliente e parou de voltar — a lista de quem vale a pena chamar.
 *
 * Fica fora do seletor de mês: "há 40 dias sem voltar" se conta a partir de
 * hoje, não do mês que a tela está mostrando. O subtítulo diz isso em voz alta,
 * porque a tela inteira acima é sobre um mês e a mudança de referência
 * confundiria sem aviso.
 */
export default function CartaoDeSumidos({ sumidos, diasLimite }: Props) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);

  return (
    <View style={styles.cartao} testID="clientes-sumidos">
      <Text style={styles.titulo}>Clientes sumidos</Text>
      <Text style={styles.subtitulo}>
        {`Sem voltar há mais de ${diasLimite} dias, contados de hoje.`}
      </Text>

      {sumidos.length === 0 ? (
        <Text style={styles.vazio}>
          {'Ninguém sumiu. Todos os seus clientes voltaram dentro do prazo.'}
        </Text>
      ) : (
        sumidos.map(c => (
          <View key={c.clienteId} style={styles.linha}>
            <View style={styles.textos}>
              <Text style={styles.nome} numberOfLines={1}>
                {c.nome}
              </Text>
              <Text style={styles.detalhe}>
                {`${
                  c.visitas === 1 ? '1 visita' : `${c.visitas} visitas`
                } · última em ${dateUtils.formatDate(c.ultimaVisitaMs)}`}
              </Text>
            </View>
            <Text style={styles.dias}>{`${c.diasSemVoltar}d`}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function createStyles(D: AppColors) {
  return StyleSheet.create({
    cartao: {
      borderRadius: radii.md,
      padding: spacing.sm,
      backgroundColor: D.card,
      borderWidth: 1,
      borderColor: D.border,
      gap: spacing.xs,
    },
    titulo: {
      color: D.ink,
      fontFamily: T.family.extraBold,
      fontSize: T.size.body,
    },
    subtitulo: {
      color: D.ink2,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
    },
    vazio: {
      color: D.ink2,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      marginTop: spacing.xs,
    },
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    textos: { flex: 1 },
    nome: {
      color: D.ink,
      fontFamily: T.family.medium,
      fontSize: T.size.secondary,
    },
    detalhe: {
      color: D.ink3,
      fontFamily: T.family.regular,
      fontSize: T.size.caption,
    },
    dias: {
      color: D.accent,
      fontFamily: T.family.extraBold,
      fontSize: T.size.body,
    },
  });
}
