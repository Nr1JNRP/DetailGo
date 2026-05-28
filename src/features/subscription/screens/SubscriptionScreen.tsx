import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Check,
  CheckCircle2,
  Copy,
  LogOut,
  MessageCircle,
  QrCode,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';
import { getAuth } from '@react-native-firebase/auth';

import { radii, spacing, typography as T, useAppTheme, type AppColors } from '@shared/theme';
import { useShop } from '@features/shops';
import { useAuth } from '@features/auth';

const PLAN_PRICE = 'R$ 0,01/m\u00eas';
const WHATSAPP_NUMBER = '5511996784399';
const CREATE_PIX_URL = 'https://us-central1-magic-auto.cloudfunctions.net/createPixCharge';

const BENEFITS = ['Agenda liberada', 'Loja vis\u00edvel no mapa', 'Hist\u00f3rico e dashboard'];

type PixData = {
  payment_id: string;
  qr_code: string;
  qr_code_base64: string;
  expires_at: string;
};

export default function SubscriptionScreen() {
  const { colors: D, isLight } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);

  const { shop, trialDaysLeft } = useShop();
  const { signOut } = useAuth();

  const [pixData, setPixData] = useState<PixData | null>(null);
  const [loadingPix, setLoadingPix] = useState(false);
  const [copied, setCopied] = useState(false);

  const isTrialActive = trialDaysLeft > 0;
  const priceValue = PLAN_PRICE.replace('/m\u00eas', '');

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
      Alert.alert('Erro', e?.message ?? 'N\u00e3o foi poss\u00edvel gerar o PIX. Tente novamente.');
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
      `Ol\u00e1! Acabei de fazer o pagamento do DetailGo Pro.\n\n` +
        `Loja: ${shop?.name ?? ''}\nID: ${shop?.id ?? ''}\n\nPode confirmar a ativa\u00e7\u00e3o?`,
    );
    const url = `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${text}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp n\u00e3o encontrado', `Entre em contato: ${WHATSAPP_NUMBER}`);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'right', 'bottom', 'left']}>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.brand}>DETAILGO</Text>
          <TouchableOpacity onPress={signOut} style={styles.iconButton} activeOpacity={0.75}>
            <LogOut size={20} color={D.ink} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.statusPill}>
            <ShieldCheck size={14} color={isTrialActive ? D.status.warning : D.status.error} />
            <Text style={[styles.statusText, !isTrialActive && styles.statusExpired]}>
              {isTrialActive ? `Trial: ${trialDaysLeft} dias` : 'Trial expirado'}
            </Text>
          </View>

          <Text style={styles.title}>{isTrialActive ? 'Continue no Pro' : 'Ative seu plano'}</Text>
          <Text style={styles.subtitle}>
            {'Receba agendamentos e mantenha sua est\u00e9tica vis\u00edvel.'}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{priceValue}</Text>
            <View style={styles.priceMeta}>
              <Text style={styles.pricePeriod}>{'/m\u00eas'}</Text>
              <Text style={styles.priceSmall}>sem contrato</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {!pixData && (
          <View style={styles.benefitCard}>
            <Text style={styles.sectionTitle}>{'Inclu\u00eddo no plano'}</Text>
            <View style={styles.benefitGrid}>
              {BENEFITS.map(item => (
                <View key={item} style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <Check size={13} color={D.primary} strokeWidth={3} />
                  </View>
                  <Text style={styles.benefitText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.pixCard}>
          <View style={styles.pixHeader}>
            <View style={styles.pixIcon}>
              <QrCode size={22} color={D.primary} strokeWidth={2.5} />
            </View>
            <View style={styles.pixTitleWrap}>
              <Text style={styles.pixTitle}>Pagamento PIX</Text>
              <Text style={styles.pixSubtitle}>
                {'Libera\u00e7\u00e3o autom\u00e1tica ap\u00f3s confirma\u00e7\u00e3o.'}
              </Text>
            </View>
          </View>

          {pixData ? (
            <View style={styles.qrArea}>
              {pixData.qr_code_base64 ? (
                <Image
                  source={{ uri: `data:image/png;base64,${pixData.qr_code_base64}` }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              ) : null}
              <TouchableOpacity style={styles.copyBtn} onPress={handleCopyPix} activeOpacity={0.82}>
                {copied ? (
                  <CheckCircle2 size={18} color={D.status.success} />
                ) : (
                  <Copy size={18} color={D.primary} />
                )}
                <Text style={[styles.copyText, copied && styles.copyTextDone]}>
                  {copied ? 'C\u00f3digo compartilhado' : 'Copiar c\u00f3digo PIX'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={handleGeneratePix}
                activeOpacity={0.75}
              >
                <RefreshCw size={14} color={D.ink3} />
                <Text style={styles.refreshText}>Gerar novo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, loadingPix && styles.primaryBtnDisabled]}
              onPress={handleGeneratePix}
              disabled={loadingPix}
              activeOpacity={0.86}
            >
              {loadingPix ? (
                <ActivityIndicator color={D.onPrimary} />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Gerar PIX</Text>
                  <Text style={styles.primaryBtnPrice}>{priceValue}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.supportBtn} onPress={handleWhatsApp} activeOpacity={0.82}>
          <MessageCircle size={18} color={D.ink} />
          <Text style={styles.supportText}>Suporte WhatsApp</Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>
          {'Renova\u00e7\u00e3o mensal. Cancele quando quiser.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

function createStyles(D: AppColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: D.bg,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
    },
    headerTop: {
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    brand: {
      color: D.ink,
      fontFamily: T.family.extraBold,
      fontSize: T.size.title,
      letterSpacing: 4,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: D.card,
      borderWidth: 1,
      borderColor: D.borderStrong,
    },
    heroCard: {
      borderRadius: radii.sm,
      padding: spacing.sm,
      backgroundColor: D.card,
      borderWidth: 1,
      borderColor: D.borderStrong,
    },
    statusPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radii.xl * 99,
      backgroundColor: D.primaryLight,
      marginBottom: spacing.sm,
    },
    statusText: {
      color: D.status.warning,
      fontFamily: T.family.bold,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
    },
    statusExpired: {
      color: D.status.error,
    },
    title: {
      color: D.ink,
      fontFamily: T.family.extraBold,
      fontSize: T.size.display,
      lineHeight: T.lineHeight.display,
      letterSpacing: 0,
    },
    subtitle: {
      color: D.ink2,
      fontFamily: T.family.medium,
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: D.border,
    },
    price: {
      color: D.primary,
      fontFamily: T.family.extraBold,
      fontSize: T.size.displayLarge,
      lineHeight: T.lineHeight.displayLarge,
      letterSpacing: 0,
    },
    priceMeta: {
      paddingBottom: spacing.xs,
    },
    pricePeriod: {
      color: D.ink,
      fontFamily: T.family.extraBold,
      fontSize: T.size.bodyLarge,
      lineHeight: T.lineHeight.body,
    },
    priceSmall: {
      color: D.ink3,
      fontFamily: T.family.medium,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      gap: spacing.sm,
    },
    benefitCard: {
      borderRadius: radii.sm,
      padding: spacing.sm,
      backgroundColor: D.surface,
      borderWidth: 1,
      borderColor: D.border,
    },
    sectionTitle: {
      color: D.ink,
      fontFamily: T.family.extraBold,
      fontSize: T.size.bodyLarge,
      lineHeight: T.lineHeight.bodyLarge,
      marginBottom: spacing.sm,
    },
    benefitGrid: {
      gap: spacing.xs,
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    benefitIcon: {
      width: 24,
      height: 24,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: D.primaryLight,
    },
    benefitText: {
      flex: 1,
      color: D.ink2,
      fontFamily: T.family.semiBold,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
    },
    pixCard: {
      borderRadius: radii.sm,
      padding: spacing.sm,
      backgroundColor: D.surface,
      borderWidth: 1,
      borderColor: D.borderStrong,
    },
    pixHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    pixIcon: {
      width: 44,
      height: 44,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: D.primaryLight,
    },
    pixTitleWrap: {
      flex: 1,
    },
    pixTitle: {
      color: D.ink,
      fontFamily: T.family.extraBold,
      fontSize: T.size.title,
      lineHeight: T.lineHeight.title,
    },
    pixSubtitle: {
      color: D.ink3,
      fontFamily: T.family.medium,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      marginTop: spacing.xs / 2,
    },
    primaryBtn: {
      height: 52,
      borderRadius: radii.sm,
      backgroundColor: D.primary,
      alignItems: 'center',
      justifyContent: 'space-between',
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
    },
    primaryBtnDisabled: {
      opacity: 0.55,
    },
    primaryBtnText: {
      color: D.onPrimary,
      fontFamily: T.family.extraBold,
      fontSize: T.size.bodyLarge,
      lineHeight: T.lineHeight.body,
    },
    primaryBtnPrice: {
      color: D.onPrimary,
      fontFamily: T.family.extraBold,
      fontSize: T.size.bodyLarge,
      lineHeight: T.lineHeight.body,
    },
    qrArea: {
      alignItems: 'center',
      gap: spacing.sm,
    },
    qrImage: {
      width: 144,
      height: 144,
      borderRadius: radii.sm,
      backgroundColor: D.qrBackground,
    },
    copyBtn: {
      width: '100%',
      height: 48,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: D.borderFocus,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    copyText: {
      color: D.primary,
      fontFamily: T.family.extraBold,
      fontSize: T.size.secondary,
    },
    copyTextDone: {
      color: D.status.success,
    },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs / 2,
    },
    refreshText: {
      color: D.ink3,
      fontFamily: T.family.semiBold,
      fontSize: T.size.secondary,
    },
    supportBtn: {
      marginTop: spacing.md,
      height: 50,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: D.borderStrong,
      backgroundColor: D.card,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    supportText: {
      color: D.ink,
      fontFamily: T.family.extraBold,
      fontSize: T.size.body,
    },
    footerNote: {
      color: D.ink3,
      fontFamily: T.family.medium,
      fontSize: T.size.caption,
      lineHeight: T.lineHeight.caption,
      textAlign: 'center',
    },
  });
}
