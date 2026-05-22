import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Clock,
  CheckCircle2,
  MessageCircle,
  Copy,
  Zap,
  Shield,
  TrendingUp,
  LogOut,
  RefreshCw,
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { getAuth } from '@react-native-firebase/auth';

import { colors, spacing, radii, typography as T } from '@shared/theme';
import { useShop } from '@features/shops';
import { useAuth } from '@features/auth';

// ── Configurações ──────────────────────────────────────────────────────────
const PLAN_PRICE = 'R$ 0,01/mês'; // DEV: mudar para R$ 89,00/mês antes de lançar
const WHATSAPP_NUMBER = '5511996784399';
const CREATE_PIX_URL = 'https://us-central1-magic-auto.cloudfunctions.net/createPixCharge';
// ───────────────────────────────────────────────────────────────────────────

const FEATURES = [
  'Agendamentos ilimitados',
  'Dashboard completo de agendamentos',
  'Histórico detalhado',
  'Visibilidade no mapa para clientes',
  'Configuração de horários e capacidade',
  'Suporte via WhatsApp',
];

type PixData = {
  payment_id: string;
  qr_code: string;
  qr_code_base64: string;
  expires_at: string;
};

export default function SubscriptionScreen() {
  const { shop, trialDaysLeft } = useShop();
  const { signOut } = useAuth();

  const [pixData, setPixData] = useState<PixData | null>(null);
  const [loadingPix, setLoadingPix] = useState(false);
  const [copied, setCopied] = useState(false);

  const isTrialActive = trialDaysLeft > 0;

  const handleGeneratePix = async () => {
    if (!shop?.id) return;
    setLoadingPix(true);
    setPixData(null);

    try {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();

      const response = await fetch(CREATE_PIX_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ shopId: shop.id }),
      });

      const result = (await response.json()) as Record<string, any>;

      if (!response.ok) {
        throw new Error(result?.error ?? 'Erro ao gerar PIX.');
      }

      setPixData(result as PixData);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível gerar o PIX. Tente novamente.');
    } finally {
      setLoadingPix(false);
    }
  };

  const handleCopyPix = async () => {
    if (!pixData?.qr_code) return;
    await Share.share({ message: pixData.qr_code });
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleWhatsApp = async () => {
    const text = encodeURIComponent(
      `Olá! Acabei de fazer o pagamento do DetailGo Pro.\n\n` +
        `Loja: ${shop?.name ?? ''}\nID: ${shop?.id ?? ''}\n\nPode confirmar a ativação?`,
    );
    const url = `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${text}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp não encontrado', `Entre em contato: ${WHATSAPP_NUMBER}`);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary.main} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* ── Header ── */}
          <LinearGradient
            colors={[colors.primary.main, colors.secondary.main]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerTop}>
              <Text style={styles.brand}>DETAILGO</Text>
              <TouchableOpacity onPress={signOut} style={styles.logoutBtn} activeOpacity={0.7}>
                <LogOut size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>

            {isTrialActive ? (
              <>
                <View style={styles.trialBadge}>
                  <Clock size={14} color="#F97316" />
                  <Text style={styles.trialBadgeText}>
                    Trial gratuito · {trialDaysLeft} {trialDaysLeft === 1 ? 'dia' : 'dias'}{' '}
                    restantes
                  </Text>
                </View>
                <Text style={styles.headerTitle}>Seu trial está ativo</Text>
                <Text style={styles.headerSubtitle}>
                  Assine agora para não perder o acesso quando expirar.
                </Text>
              </>
            ) : (
              <>
                <View style={[styles.trialBadge, styles.expiredBadge]}>
                  <Clock size={14} color={colors.status.error} />
                  <Text style={[styles.trialBadgeText, styles.expiredBadgeText]}>
                    Trial expirado
                  </Text>
                </View>
                <Text style={styles.headerTitle}>Ative seu plano</Text>
                <Text style={styles.headerSubtitle}>
                  Para receber agendamentos, ative o plano Pro.
                </Text>
              </>
            )}

            <View style={styles.priceBox}>
              <Text style={styles.price}>R$ 0,01</Text>
              <View>
                <Text style={styles.pricePer}>/mês</Text>
                <Text style={styles.priceSub}>sem contrato</Text>
              </View>
            </View>
          </LinearGradient>

          {/* ── Funcionalidades ── */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Zap size={18} color={colors.primary.main} />
              <Text style={styles.cardTitle}>O que está incluído</Text>
            </View>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <CheckCircle2 size={16} color={colors.status.success} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          {/* ── Pagamento PIX ── */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Shield size={18} color={colors.primary.main} />
              <Text style={styles.cardTitle}>Pagar com PIX</Text>
            </View>

            {!pixData ? (
              <>
                <Text style={styles.pixIntro}>
                  Clique para gerar um QR Code PIX exclusivo para sua loja. Assim que o pagamento
                  for confirmado, seu acesso é liberado automaticamente em segundos.
                </Text>

                <TouchableOpacity
                  style={[styles.generateBtn, loadingPix && styles.generateBtnDisabled]}
                  onPress={handleGeneratePix}
                  disabled={loadingPix}
                  activeOpacity={0.85}
                >
                  {loadingPix ? (
                    <ActivityIndicator color={colors.text.white} />
                  ) : (
                    <Text style={styles.generateBtnText}>
                      Gerar QR Code PIX — {PLAN_PRICE.replace('/mês', '')}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* QR Code */}
                <View style={styles.qrContainer}>
                  {pixData.qr_code_base64 ? (
                    <Image
                      source={{ uri: `data:image/png;base64,${pixData.qr_code_base64}` }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                  ) : null}
                </View>

                <Text style={styles.qrInstructions}>
                  Abra o app do seu banco → PIX → Pagar com QR Code
                </Text>

                {/* Copia e Cola */}
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={handleCopyPix}
                  activeOpacity={0.8}
                >
                  {copied ? (
                    <>
                      <CheckCircle2 size={18} color={colors.status.success} />
                      <Text style={[styles.copyBtnText, { color: colors.status.success }]}>
                        Código copiado!
                      </Text>
                    </>
                  ) : (
                    <>
                      <Copy size={18} color={colors.primary.main} />
                      <Text style={styles.copyBtnText}>Copiar código PIX (copia e cola)</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Gerar novo */}
                <TouchableOpacity
                  style={styles.regenerateBtn}
                  onPress={handleGeneratePix}
                  activeOpacity={0.7}
                >
                  <RefreshCw size={14} color={colors.text.tertiary} />
                  <Text style={styles.regenerateBtnText}>Gerar novo código</Text>
                </TouchableOpacity>

                {/* Aviso automático */}
                <View style={styles.autoActivateBox}>
                  <CheckCircle2 size={14} color={colors.status.success} />
                  <Text style={styles.autoActivateText}>
                    Após o pagamento, seu acesso é liberado automaticamente em até 1 minuto.
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* ── Dúvidas ── */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.whatsappBtn}
              onPress={handleWhatsApp}
              activeOpacity={0.85}
            >
              <MessageCircle size={20} color="#FFFFFF" />
              <Text style={styles.whatsappBtnText}>Falar com suporte no WhatsApp</Text>
            </TouchableOpacity>
          </View>

          {/* ── Nota ── */}
          <View style={styles.noteBox}>
            <TrendingUp size={14} color={colors.text.tertiary} />
            <Text style={styles.noteText}>Renovação mensal. Cancele quando quiser sem multa.</Text>
          </View>

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background.main },
  content: { flexGrow: 1 },
  header: {
    padding: spacing.lg,
    paddingBottom: 32,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    marginBottom: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  brand: {
    fontSize: 20,
    fontFamily: T.family.extraBold,
    color: colors.text.white,
    letterSpacing: 1.5,
  },
  logoutBtn: { padding: spacing.xs },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FFF7ED',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: spacing.sm,
  },
  expiredBadge: { backgroundColor: '#FEF2F2' },
  trialBadgeText: { fontSize: 12, fontFamily: T.family.bold, color: '#F97316' },
  expiredBadgeText: { color: colors.status.error },
  headerTitle: {
    fontSize: 26,
    fontFamily: T.family.extraBold,
    color: colors.text.white,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: T.family.regular,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  price: { fontSize: 36, fontFamily: T.family.extraBold, color: colors.text.white, lineHeight: 40 },
  pricePer: { fontSize: 16, fontFamily: T.family.bold, color: 'rgba(255,255,255,0.9)' },
  priceSub: { fontSize: 11, fontFamily: T.family.regular, color: 'rgba(255,255,255,0.7)' },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.main,
    shadowColor: colors.text.primary,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 16, fontFamily: T.family.bold, color: colors.text.primary },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  featureText: {
    fontSize: 14,
    fontFamily: T.family.regular,
    color: colors.text.secondary,
    flex: 1,
  },
  pixIntro: {
    fontSize: 14,
    fontFamily: T.family.regular,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  generateBtn: {
    height: 52,
    backgroundColor: colors.primary.main,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnDisabled: { backgroundColor: colors.text.disabled },
  generateBtnText: { color: colors.text.white, fontSize: 15, fontFamily: T.family.bold },
  qrContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.main,
  },
  qrImage: { width: 200, height: 200 },
  qrInstructions: {
    fontSize: 13,
    fontFamily: T.family.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary.main,
    marginBottom: spacing.sm,
  },
  copyBtnText: { fontSize: 14, fontFamily: T.family.bold, color: colors.primary.main },
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  regenerateBtnText: { fontSize: 12, fontFamily: T.family.regular, color: colors.text.tertiary },
  autoActivateBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: '#F0FDF4',
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  autoActivateText: {
    fontSize: 12,
    color: colors.status.success,
    flex: 1,
    fontFamily: T.family.semiBold,
    lineHeight: 16,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#25D366',
    borderRadius: radii.md,
    paddingVertical: 14,
  },
  whatsappBtnText: { fontSize: 15, fontFamily: T.family.bold, color: '#FFFFFF' },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  noteText: { fontSize: 12, fontFamily: T.family.regular, color: colors.text.tertiary, flex: 1 },
});
