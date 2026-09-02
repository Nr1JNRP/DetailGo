import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { BarChart } from 'react-native-gifted-charts';

import { radii, spacing, typography as T, useAppTheme, type AppColors } from '@shared/theme';
import { useFeedback } from '@shared/components/FeedbackProvider';
import { formatUtils } from '@shared/utils/format.utils';
import { useShop } from '@features/shops';
import { buscarConcluidosDoMes } from '../data/reportsRepo';
import {
  ehMesCorrente,
  limitesDoMes,
  mesAnterior,
  mesSeguinte,
  periodoAtual,
  rotuloDoPeriodo,
  type Periodo,
} from '../domain/periodo';
import { agruparPorServico, totalDeServicos, type LinhaDeServico } from '../domain/serviceReport';

/** Nome longo de serviço não cabe no eixo; corta com reticências. */
function encurtar(nome: string, max = 14): string {
  return nome.length <= max ? nome : `${nome.slice(0, max - 1)}…`;
}

export default function ReportsScreen() {
  const { colors: D, isLight } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const navigation = useNavigation();
  const { shopId } = useShop();
  const { showError } = useFeedback();

  const [periodo, setPeriodo] = useState<Periodo>(() => periodoAtual());
  const [linhas, setLinhas] = useState<LinhaDeServico[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!shopId) return;
    setCarregando(true);
    try {
      const concluidos = await buscarConcluidosDoMes(shopId, limitesDoMes(periodo));
      setLinhas(agruparPorServico(concluidos));
    } catch {
      setLinhas([]);
      showError('Não foi possível carregar o relatório.');
    } finally {
      setCarregando(false);
    }
  }, [periodo, shopId, showError]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const total = totalDeServicos(linhas);
  const rotulo = rotuloDoPeriodo(periodo);
  const noMesCorrente = ehMesCorrente(periodo);

  const barras = useMemo(
    () =>
      linhas.map(l => ({
        value: l.quantidade,
        label: encurtar(l.servico),
        frontColor: D.primary,
        // O gráfico esconde o eixo Y, então o número tem de vir em cima da
        // barra — sem ele não há quantidade nenhuma para ler. A lib só aceita
        // isso como fábrica de componente; é um rótulo sem estado, nada para
        // o remonte destruir.
        // eslint-disable-next-line react/no-unstable-nested-components
        topLabelComponent: () => <Text style={styles.valorDaBarra}>{l.quantidade}</Text>,
      })),
    [D.primary, linhas, styles.valorDaBarra],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'right', 'bottom', 'left']}>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />

      <View style={styles.header}>
        <TouchableOpacity
          testID="voltar"
          style={styles.iconButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={20} color={D.ink} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Relatórios</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.seletorDeMes}>
        <TouchableOpacity
          testID="mes-anterior"
          style={styles.iconButton}
          onPress={() => setPeriodo(mesAnterior(periodo))}
        >
          <ChevronLeft size={20} color={D.ink} strokeWidth={2.5} />
        </TouchableOpacity>

        <Text style={styles.mesTexto}>{rotulo}</Text>

        {/* Sem seta de avançar no mês corrente: não há futuro para relatar. */}
        {noMesCorrente ? (
          <View style={styles.iconButton} />
        ) : (
          <TouchableOpacity
            testID="mes-seguinte"
            style={styles.iconButton}
            onPress={() => setPeriodo(mesSeguinte(periodo))}
          >
            <ChevronRight size={20} color={D.ink} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>

      {carregando ? (
        <View style={styles.centro}>
          <ActivityIndicator color={D.primary} />
        </View>
      ) : linhas.length === 0 ? (
        <View style={styles.centro}>
          <Text style={styles.vazioTitulo}>{`Nenhum serviço concluído em ${rotulo}`}</Text>
          <Text style={styles.vazioTexto}>
            {'O relatório conta os agendamentos que você marcou como concluídos no painel.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.conteudo}>
          <View style={styles.cartao}>
            <Text style={styles.cartaoTitulo}>Serviços realizados</Text>
            <Text style={styles.cartaoTotal}>
              {total === 1 ? '1 serviço' : `${total} serviços`}
            </Text>

            <View style={styles.grafico}>
              <BarChart
                data={barras}
                barWidth={26}
                spacing={22}
                initialSpacing={12}
                barBorderRadius={6}
                hideRules
                hideYAxisText
                yAxisThickness={0}
                xAxisThickness={0}
                xAxisLabelTextStyle={styles.rotuloDoEixo}
                height={180}
                disableScroll={false}
              />
            </View>
          </View>

          <View style={styles.cartao}>
            <Text style={styles.cartaoTitulo}>Detalhe por serviço</Text>
            {linhas.map(l => (
              <View key={l.servico} style={styles.linha}>
                <Text style={styles.linhaNome} numberOfLines={1}>
                  {l.servico}
                </Text>
                <View style={styles.linhaNumeros}>
                  <Text style={styles.linhaQuantidade}>{l.quantidade}x</Text>
                  <Text style={styles.linhaValor}>{formatUtils.currency(l.faturamento)}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(D: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: D.bg },
    header: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
    },
    headerTitle: {
      color: D.ink,
      fontFamily: T.family.extraBold,
      fontSize: T.size.bodyLarge,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    seletorDeMes: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    mesTexto: {
      color: D.ink,
      fontFamily: T.family.bold,
      fontSize: T.size.body,
    },
    centro: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      gap: spacing.xs,
    },
    vazioTitulo: {
      color: D.ink,
      fontFamily: T.family.extraBold,
      fontSize: T.size.body,
      textAlign: 'center',
    },
    vazioTexto: {
      color: D.ink2,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      textAlign: 'center',
    },
    conteudo: { padding: spacing.lg, gap: spacing.lg },
    cartao: {
      borderRadius: radii.sm,
      padding: spacing.sm,
      backgroundColor: D.card,
      borderWidth: 1,
      borderColor: D.borderStrong,
      gap: spacing.xs,
    },
    cartaoTitulo: {
      color: D.ink,
      fontFamily: T.family.extraBold,
      fontSize: T.size.body,
    },
    cartaoTotal: {
      color: D.primary,
      fontFamily: T.family.extraBold,
      fontSize: T.size.titleLarge,
    },
    grafico: { marginTop: spacing.sm },
    valorDaBarra: {
      color: D.ink2,
      fontFamily: T.family.bold,
      fontSize: T.size.caption,
      marginBottom: 2,
    },
    rotuloDoEixo: {
      color: D.ink2,
      fontFamily: T.family.regular,
      fontSize: T.size.caption,
    },
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
      gap: spacing.sm,
    },
    linhaNome: {
      flex: 1,
      color: D.ink,
      fontFamily: T.family.medium,
      fontSize: T.size.secondary,
    },
    linhaNumeros: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    linhaQuantidade: {
      color: D.ink,
      fontFamily: T.family.extraBold,
      fontSize: T.size.body,
    },
    linhaValor: {
      color: D.ink2,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      minWidth: 78,
      textAlign: 'right',
    },
  });
}
