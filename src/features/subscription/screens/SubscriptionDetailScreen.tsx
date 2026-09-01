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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, CreditCard, QrCode } from 'lucide-react-native';

import { radii, spacing, typography as T, useAppTheme, type AppColors } from '@shared/theme';
import { useFeedback } from '@shared/components/FeedbackProvider';
import { formatUtils } from '@shared/utils/format.utils';
import { dateUtils } from '@shared/utils/date.utils';
import { useShop } from '@features/shops';
import type { RootStackParamList } from '@app/types';
import {
  cancelSubscription,
  fetchSubscription,
  type SubscriptionView,
} from '../services/subscription.service';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Data do Asaas (AAAA-MM-DD) no formato que o dono lê. */
function formatarData(iso: string | null): string {
  if (!iso) return '--';
  const [ano, mes, dia] = iso.split('-').map(Number);
  if (!ano || !mes || !dia) return '--';
  return dateUtils.formatDate(new Date(ano, mes - 1, dia).getTime());
}

export default function SubscriptionDetailScreen() {
  const { colors: D, isLight } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const navigation = useNavigation<Nav>();
  const { shop, shopId } = useShop();
  const { showError, showSuccess, showConfirm } = useFeedback();

  const [assinatura, setAssinatura] = useState<SubscriptionView | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [cancelando, setCancelando] = useState(false);

  const acessoAte = shop?.activeUntil?.toMillis?.()
    ? dateUtils.formatDate(shop.activeUntil.toMillis())
    : '--';

  const carregar = useCallback(async () => {
    if (!shopId) return;
    setCarregando(true);
    try {
      setAssinatura(await fetchSubscription(shopId));
    } catch (e: any) {
      showError(e?.message ?? 'Não foi possível carregar a assinatura.');
    } finally {
      setCarregando(false);
    }
  }, [shopId, showError]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const confirmarCancelamento = () => {
    // A confirmação diz até quando o acesso vale. Sem isso o dono hesita, ou
    // pior, cancela achando que perde tudo na hora.
    showConfirm({
      title: 'Cancelar assinatura',
      message: `A cobrança automática para. Seu acesso continua até ${acessoAte}, que você já pagou.`,
      confirmLabel: 'Cancelar assinatura',
      destructive: true,
      onConfirm: async () => {
        if (!shopId) return;
        setCancelando(true);
        try {
          await cancelSubscription(shopId);
          setAssinatura(null);
          showSuccess(`Assinatura cancelada. Seu acesso vale até ${acessoAte}.`);
        } catch (e: any) {
          showError(e?.message ?? 'Não foi possível cancelar. Tente de novo.');
        } finally {
          setCancelando(false);
        }
      },
    });
  };

  const temRecorrencia = assinatura?.ativa === true;

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
        <Text style={styles.headerTitle}>Assinatura</Text>
        <View style={styles.iconButton} />
      </View>

      {carregando ? (
        <View style={styles.center}>
          <ActivityIndicator color={D.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.icon}>
                {temRecorrencia ? (
                  <CreditCard size={20} color={D.primary} strokeWidth={2.5} />
                ) : (
                  <QrCode size={20} color={D.primary} strokeWidth={2.5} />
                )}
              </View>
              <Text style={styles.cardTitle}>
                {temRecorrencia ? 'Cartão de crédito' : 'Pagamento avulso'}
              </Text>
            </View>

            {temRecorrencia ? (
              <>
                <Linha
                  styles={styles}
                  rotulo="Valor"
                  valor={formatUtils.currency(assinatura?.valor ?? null)}
                />
                <Linha
                  styles={styles}
                  rotulo="Próxima cobrança"
                  valor={formatarData(assinatura?.proximaCobranca ?? null)}
                />
                <Linha styles={styles} rotulo="Renovação" valor="Automática, todo mês" />
              </>
            ) : (
              <>
                <Linha styles={styles} rotulo="Forma" valor="Pix, pago manualmente" />
                <Text style={styles.aviso}>
                  {'O Pix não renova sozinho. Você precisa pagar de novo a cada mês.'}
                </Text>
              </>
            )}

            <Linha styles={styles} rotulo="Acesso até" valor={acessoAte} destaque />
          </View>

          {temRecorrencia ? (
            <TouchableOpacity
              testID="cancelar-assinatura"
              style={[styles.btnPerigo, cancelando && styles.btnDesabilitado]}
              onPress={confirmarCancelamento}
              disabled={cancelando}
              activeOpacity={0.85}
            >
              {cancelando ? (
                <ActivityIndicator color={D.status.error} />
              ) : (
                <Text style={styles.btnPerigoTexto}>Cancelar assinatura</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="mudar-para-cartao"
              style={styles.btnPrimario}
              onPress={() => navigation.navigate('Subscription')}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimarioTexto}>{'Mudar para cartão e renovar sozinho'}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

type LinhaProps = {
  styles: ReturnType<typeof createStyles>;
  rotulo: string;
  valor: string;
  destaque?: boolean;
};

/** Linha rotulo/valor do cartao. Fora do componente: definida dentro, o React
 *  recria o tipo a cada render e descarta a subarvore. */
function Linha({ styles, rotulo, valor, destaque }: LinhaProps) {
  return (
    <View style={styles.linha}>
      <Text style={styles.linhaRotulo}>{rotulo}</Text>
      <Text style={[styles.linhaValor, destaque && styles.linhaValorDestaque]}>{valor}</Text>
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
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: spacing.lg, gap: spacing.lg },
    card: {
      borderRadius: radii.sm,
      padding: spacing.sm,
      backgroundColor: D.card,
      borderWidth: 1,
      borderColor: D.borderStrong,
      gap: spacing.xs,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: D.surface,
    },
    cardTitle: {
      color: D.ink,
      fontFamily: T.family.extraBold,
      fontSize: T.size.body,
    },
    linha: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    linhaRotulo: {
      color: D.ink2,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
    },
    linhaValor: {
      color: D.ink,
      fontFamily: T.family.extraBold,
      fontSize: T.size.body,
    },
    linhaValorDestaque: { color: D.primary },
    aviso: {
      color: D.ink2,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
    },
    btnPrimario: {
      height: 52,
      borderRadius: radii.sm,
      backgroundColor: D.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPrimarioTexto: {
      color: D.onPrimary,
      fontFamily: T.family.extraBold,
      fontSize: T.size.body,
    },
    btnPerigo: {
      height: 52,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: D.status.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPerigoTexto: {
      color: D.status.error,
      fontFamily: T.family.extraBold,
      fontSize: T.size.body,
    },
    btnDesabilitado: { opacity: 0.55 },
  });
}
