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
import { ArrowLeft, Car, ChevronLeft, ChevronRight, Star, Trophy } from 'lucide-react-native';

import { radii, spacing, typography as T, useAppTheme, type AppColors } from '@shared/theme';
import { useFeedback } from '@shared/components/FeedbackProvider';
import { formatUtils } from '@shared/utils/format.utils';
import { useShop } from '@features/shops';
import type { AdminAppointment } from '@features/admin';
import BarrasProporcionais from '../components/BarrasProporcionais';
import CartaoDeSumidos from '../components/CartaoDeSumidos';
import PodioDeClientes from '../components/PodioDeClientes';
import RoscaDeServicos from '../components/RoscaDeServicos';
import { buscarConcluidosDoMes, buscarHistoricoDeClientes } from '../data/reportsRepo';
import { agruparPorDiaDaSemana, agruparPorHorario } from '../domain/agenda';
import { rankearClientes } from '../domain/clientes';
import { destaquesDoMes, type Destaque } from '../domain/destaques';
import { calcularRecorrencia, clientesSumidos } from '../domain/recorrencia';
import { resumoDoMes } from '../domain/resumo';
import { valorCurto } from '../domain/valorCurto';
import { agruparPorVeiculo } from '../domain/veiculos';
import {
  ehMesCorrente,
  limitesDoMes,
  mesAnterior,
  mesSeguinte,
  periodoAtual,
  rotuloDoPeriodo,
  type Periodo,
} from '../domain/periodo';
import {
  agruparPorServico,
  insightDeFaturamento,
  ordenarPorFaturamento,
  totalDeServicos,
} from '../domain/serviceReport';

/** Cliente que não volta há mais que isso entra na lista de sumidos. */
const DIAS_PARA_SUMIR = 45;

/** Janela do histórico que alimenta recorrência e sumidos. */
const MESES_DE_HISTORICO = 12;

export default function ReportsScreen() {
  const { colors: D, isLight } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const navigation = useNavigation();
  const { shopId } = useShop();
  const { showError } = useFeedback();

  const [periodo, setPeriodo] = useState<Periodo>(() => periodoAtual());
  const [agendamentos, setAgendamentos] = useState<AdminAppointment[]>([]);
  const [historico, setHistorico] = useState<AdminAppointment[]>([]);
  const [carregando, setCarregando] = useState(true);

  const limites = useMemo(() => limitesDoMes(periodo), [periodo]);

  const carregar = useCallback(async () => {
    if (!shopId) return;
    setCarregando(true);
    try {
      setAgendamentos(await buscarConcluidosDoMes(shopId, limites));
    } catch {
      setAgendamentos([]);
      showError('Não foi possível carregar o relatório.');
    } finally {
      setCarregando(false);
    }
  }, [limites, shopId, showError]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // O histórico não anda com as setas de mês: recorrência e cliente sumido
  // olham para trás e para hoje, não para o mês na tela. Buscado uma vez, e uma
  // falha aqui só esvazia esses dois cartões — o resto do relatório continua.
  useEffect(() => {
    if (!shopId) return;
    let ativo = true;

    const desde = new Date();
    desde.setMonth(desde.getMonth() - MESES_DE_HISTORICO);

    buscarHistoricoDeClientes(shopId, desde.getTime())
      .then(dados => {
        if (ativo) setHistorico(dados);
      })
      .catch(() => {
        if (ativo) setHistorico([]);
      });

    return () => {
      ativo = false;
    };
  }, [shopId]);

  // Tudo derivado das mesmas listas: cada número vem de uma função pura testada
  // à parte, e a tela só monta os cartões.
  const servicos = useMemo(() => agruparPorServico(agendamentos), [agendamentos]);
  const resumo = useMemo(() => resumoDoMes(agendamentos), [agendamentos]);
  const destaques = useMemo(() => destaquesDoMes(agendamentos), [agendamentos]);
  const veiculos = useMemo(() => agruparPorVeiculo(agendamentos), [agendamentos]);
  const clientes = useMemo(() => rankearClientes(agendamentos), [agendamentos]);
  const dias = useMemo(() => agruparPorDiaDaSemana(agendamentos), [agendamentos]);
  const horarios = useMemo(() => agruparPorHorario(agendamentos), [agendamentos]);
  const porFaturamento = useMemo(() => ordenarPorFaturamento(servicos), [servicos]);
  const insight = useMemo(() => insightDeFaturamento(servicos), [servicos]);
  const recorrencia = useMemo(
    () => calcularRecorrencia(agendamentos, historico, limites.inicioMs),
    [agendamentos, historico, limites.inicioMs],
  );
  const sumidos = useMemo(
    () => clientesSumidos(historico, Date.now(), DIAS_PARA_SUMIR),
    [historico],
  );
  const total = totalDeServicos(servicos);

  const rotulo = rotuloDoPeriodo(periodo);
  const noMesCorrente = ehMesCorrente(periodo);

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
      ) : total === 0 ? (
        <View style={styles.centro}>
          <Text style={styles.vazioTitulo}>{`Nenhum serviço concluído em ${rotulo}`}</Text>
          <Text style={styles.vazioTexto}>
            {'O relatório conta os agendamentos que você marcou como concluídos no painel.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.conteudo}>
          <View style={styles.resumo} testID="resumo">
            <Numero rotulo="Serviços" valor={String(resumo.servicos)} styles={styles} />
            <Numero
              rotulo="Faturamento"
              valor={valorCurto(resumo.faturamento)}
              styles={styles}
              destaque
            />
            <Numero rotulo="Ticket médio" valor={valorCurto(resumo.ticketMedio)} styles={styles} />
          </View>

          <View style={styles.grupoDeDestaques} testID="destaques">
            <LinhaDeDestaque
              destaque={destaques.servico}
              icone={<Trophy size={20} color={D.primary} strokeWidth={2.5} />}
              styles={styles}
            />
            <LinhaDeDestaque
              destaque={destaques.veiculo}
              icone={<Car size={20} color={D.primary} strokeWidth={2.5} />}
              styles={styles}
            />
            <LinhaDeDestaque
              destaque={destaques.cliente}
              icone={<Star size={20} color={D.primary} strokeWidth={2.5} />}
              styles={styles}
            />
          </View>

          <Text style={styles.secao}>Serviços</Text>

          <View style={styles.cartao}>
            <Text style={styles.cartaoTitulo}>Serviços realizados</Text>
            <RoscaDeServicos linhas={servicos} total={total} />
          </View>

          <View style={styles.cartao}>
            <Text style={styles.cartaoTitulo}>O que mais rende</Text>
            {insight ? <Text style={styles.cartaoSubtitulo}>{insight}</Text> : null}
            <BarrasProporcionais
              testID="barras-faturamento"
              barras={porFaturamento.map(l => ({
                rotulo: l.servico,
                valor: l.faturamento,
                texto: formatUtils.currency(l.faturamento),
              }))}
            />
          </View>

          <Text style={styles.secao}>Agenda</Text>

          <View style={styles.cartao}>
            <Text style={styles.cartaoTitulo}>Movimento por dia</Text>
            <Text style={styles.cartaoSubtitulo}>
              {'O dia vazio vale tanto quanto o cheio: é onde cabe uma promoção.'}
            </Text>
            <BarrasProporcionais
              testID="barras-dias"
              barras={dias.map(d => ({
                rotulo: d.rotulo,
                valor: d.quantidade,
                texto: String(d.quantidade),
              }))}
            />
          </View>

          <View style={styles.cartao}>
            <Text style={styles.cartaoTitulo}>Horários mais procurados</Text>
            <BarrasProporcionais
              testID="barras-horarios"
              barras={horarios.map(h => ({
                rotulo: h.rotulo,
                valor: h.quantidade,
                texto: String(h.quantidade),
              }))}
            />
          </View>

          <View style={styles.cartao}>
            <Text style={styles.cartaoTitulo}>Veículos atendidos</Text>
            <BarrasProporcionais
              testID="barras-veiculos"
              barras={veiculos.map(v => ({
                rotulo: v.rotulo,
                valor: v.quantidade,
                texto: String(v.quantidade),
              }))}
            />
          </View>

          <Text style={styles.secao}>Clientes</Text>

          <View style={styles.cartao} testID="recorrencia">
            <Text style={styles.cartaoTitulo}>Quem voltou</Text>
            <Text style={styles.cartaoSubtitulo}>
              {recorrencia.recorrentes === 0
                ? `Todos os clientes de ${rotulo} vieram pela primeira vez.`
                : `${recorrencia.recorrentes} de ${recorrencia.clientes} clientes de ${rotulo} já eram seus antes do mês.`}
            </Text>
            <BarrasProporcionais
              testID="barras-recorrencia"
              barras={[
                {
                  rotulo: 'Já eram clientes',
                  valor: recorrencia.recorrentes,
                  texto: String(recorrencia.recorrentes),
                },
                { rotulo: 'Novos', valor: recorrencia.novos, texto: String(recorrencia.novos) },
              ]}
            />
          </View>

          <View style={styles.cartao}>
            <Text style={styles.cartaoTitulo}>Melhores clientes</Text>
            <PodioDeClientes clientes={clientes} testID="podio" />
          </View>

          <CartaoDeSumidos sumidos={sumidos} diasLimite={DIAS_PARA_SUMIR} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

type Estilos = ReturnType<typeof createStyles>;

function Numero({
  rotulo,
  valor,
  styles,
  destaque,
}: {
  rotulo: string;
  valor: string;
  styles: Estilos;
  destaque?: boolean;
}) {
  return (
    <View style={styles.numero}>
      <Text style={styles.numeroRotulo}>{rotulo}</Text>
      <Text style={[styles.numeroValor, destaque && styles.numeroValorDestaque]} numberOfLines={1}>
        {valor}
      </Text>
    </View>
  );
}

/** Some quando não há dado: melhor nenhuma linha que um campeão inventado. */
function LinhaDeDestaque({
  destaque,
  icone,
  styles,
}: {
  destaque: Destaque | null;
  icone: React.ReactNode;
  styles: Estilos;
}) {
  if (!destaque) return null;

  return (
    <View style={styles.destaque}>
      {icone}
      <View style={styles.destaqueTextos}>
        <Text style={styles.destaqueRotulo}>{destaque.rotulo}</Text>
        <Text style={styles.destaqueNome} numberOfLines={1}>
          {destaque.nome}
        </Text>
      </View>
      <Text style={styles.destaqueContagem}>{destaque.contagem}</Text>
    </View>
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
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: radii.sm,
      backgroundColor: D.card,
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
    conteudo: { padding: spacing.lg, paddingTop: 0, gap: spacing.sm },

    secao: {
      color: D.ink3,
      fontFamily: T.family.bold,
      fontSize: T.size.caption,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.sm,
    },

    resumo: { flexDirection: 'row', gap: spacing.xs },
    numero: {
      flex: 1,
      borderRadius: radii.sm,
      backgroundColor: D.card,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    numeroRotulo: {
      color: D.ink3,
      fontFamily: T.family.regular,
      fontSize: T.size.caption,
    },
    numeroValor: {
      color: D.ink,
      fontFamily: T.family.extraBold,
      fontSize: T.size.bodyLarge,
    },
    numeroValorDestaque: { color: D.primary },

    grupoDeDestaques: { gap: spacing.xs },
    destaque: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.sm,
      backgroundColor: D.card,
      padding: spacing.sm,
    },
    destaqueTextos: { flex: 1 },
    destaqueRotulo: {
      color: D.ink3,
      fontFamily: T.family.regular,
      fontSize: T.size.caption,
    },
    destaqueNome: {
      color: D.ink,
      fontFamily: T.family.bold,
      fontSize: T.size.secondary,
    },
    destaqueContagem: {
      color: D.primary,
      fontFamily: T.family.extraBold,
      fontSize: T.size.body,
    },

    cartao: {
      borderRadius: radii.md,
      padding: spacing.sm,
      backgroundColor: D.card,
      borderWidth: 1,
      borderColor: D.border,
      gap: spacing.sm,
    },
    cartaoTitulo: {
      color: D.ink,
      fontFamily: T.family.extraBold,
      fontSize: T.size.body,
    },
    cartaoSubtitulo: {
      color: D.ink2,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      marginTop: -spacing.xs,
    },
  });
}
