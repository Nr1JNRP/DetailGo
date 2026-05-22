import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

import type { RootStackParamList } from '@app/types';
import { useAuth } from '@features/auth';
import { useAppTheme, type AppColors, typography as T } from '@shared/theme';

const { height: SCREEN_H } = Dimensions.get('window');
const HERO_H = Math.round(SCREEN_H * 0.48);
const BADGE_LABELS = ['Agendamentos', 'Serviços', 'Gestão', 'Clientes'];

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors: D, isLight } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [badgeIndex, setBadgeIndex] = useState(0);
  const badgeOpacity = useRef(new Animated.Value(1)).current;
  const badgeTranslateY = useRef(new Animated.Value(0)).current;
  const badgeDotScale = useRef(new Animated.Value(1)).current;

  const isValidEmail = email.includes('@') && email.includes('.');
  const isValidPassword = password.length >= 6;
  const isValid = isValidEmail && isValidPassword;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(badgeDotScale, {
          toValue: 1.45,
          duration: 760,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(badgeDotScale, {
          toValue: 1,
          duration: 760,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();

    const interval = setInterval(() => {
      Animated.parallel([
        Animated.timing(badgeOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(badgeTranslateY, {
          toValue: -8,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setBadgeIndex(current => (current + 1) % BADGE_LABELS.length);
        badgeTranslateY.setValue(8);

        Animated.parallel([
          Animated.timing(badgeOpacity, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(badgeTranslateY, {
            toValue: 0,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 1800);

    return () => {
      clearInterval(interval);
      pulse.stop();
    };
  }, [badgeDotScale, badgeOpacity, badgeTranslateY]);

  const handleLogin = async () => {
    if (!isValid) return;
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    if (!result.ok) {
      Alert.alert('Erro ao acessar', result.message || 'Email ou senha incorretos', [
        { text: 'Tentar novamente' },
      ]);
    }
  };

  const handleBlur = (field: 'email' | 'password') => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />
      <View style={styles.screen}>
        {/* ── Hero ──────────────────────────────────────────── */}
        <View style={[styles.hero, { height: HERO_H }]}>
          <LinearGradient
            colors={['#0A0D0D', '#101916', '#31451F', '#151A12', '#0A0D0D']}
            locations={[0, 0.32, 0.58, 0.76, 1]}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.95 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(10,13,13,0)', 'rgba(10,13,13,0.68)', '#0A0D0D']}
            locations={[0, 0.72, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(255,58,32,0.22)', 'rgba(255,58,32,0.06)', 'rgba(255,58,32,0)']}
            start={{ x: 0, y: 1 }}
            end={{ x: 0.7, y: 0.45 }}
            style={styles.heroWarmGradient}
          />
          <LinearGradient
            colors={['rgba(47,111,126,0.22)', 'rgba(47,111,126,0.04)', 'rgba(47,111,126,0)']}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 0.8, y: 0.65 }}
            style={styles.heroColdGradient}
          />
          <View style={styles.heroBadgeLine} />

          <View style={styles.heroContent}>
            <View style={styles.badge}>
              <Animated.View style={[styles.badgeDot, { transform: [{ scale: badgeDotScale }] }]} />
              <Animated.Text
                style={[
                  styles.badgeText,
                  {
                    opacity: badgeOpacity,
                    transform: [{ translateY: badgeTranslateY }],
                  },
                ]}
              >
                {BADGE_LABELS[badgeIndex]}
              </Animated.Text>
            </View>

            <Text style={styles.heroTitle}>
              {'DETAIL'}
              <Text style={styles.heroDot}>{'·'}</Text>
              {'\nGO.'}
            </Text>

            <Text style={styles.heroSub}>
              Plataforma de gestão e agendamento para serviços de estética automotiva.
            </Text>
          </View>
        </View>

        {/* ── Form ──────────────────────────────────────────── */}
        <View style={styles.form}>
          {/* Email */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>E-mail</Text>
            <View style={[styles.field, touched.email && !isValidEmail && styles.fieldError]}>
              <Mail size={18} color={D.ink3} />
              <TextInput
                style={styles.fieldInput}
                value={email}
                onChangeText={setEmail}
                onBlur={() => handleBlur('email')}
                placeholder="seu@email.com"
                placeholderTextColor={D.ink3}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                editable={!loading}
              />
            </View>
          </View>

          {/* Senha */}
          <View style={styles.fieldWrap}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Senha</Text>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Recuperar senha',
                    'Enviaremos um link de recuperação para seu e-mail.',
                  )
                }
              >
                <Text style={styles.forgotText}>Esqueceu?</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.field, touched.password && !isValidPassword && styles.fieldError]}>
              <Lock size={18} color={D.ink3} />
              <TextInput
                style={styles.fieldInput}
                value={password}
                onChangeText={setPassword}
                onBlur={() => handleBlur('password')}
                placeholder="••••••••"
                placeholderTextColor={D.ink3}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)}>
                {showPassword ? (
                  <EyeOff size={18} color={D.ink3} />
                ) : (
                  <Eye size={18} color={D.ink3} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.btn, (!isValid || loading) && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={!isValid || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={D.onPrimary} />
            ) : (
              <>
                <Text style={styles.btnText}>Entrar na garagem</Text>
                <View style={styles.btnArrow}>
                  <ArrowRight size={18} color={D.onPrimary} />
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* Register link */}
        </View>

        <View style={styles.footer}>
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Sem conta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7}>
              <Text style={styles.registerLink}>Criar agora</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.footerText}>© 2026 DETAILGO</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(D: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: D.bg,
    },
    screen: {
      flex: 1,
    },

    // ── Hero
    hero: {
      backgroundColor: D.bg,
      overflow: 'hidden',
      borderBottomWidth: 1,
      borderBottomColor: D.border,
    },
    heroColdGradient: {
      position: 'absolute',
      width: '72%',
      height: '72%',
      left: 0,
      top: 0,
    },
    heroWarmGradient: {
      position: 'absolute',
      width: '80%',
      height: '45%',
      left: 0,
      bottom: 0,
    },
    heroBadgeLine: {
      position: 'absolute',
      left: 48,
      right: 0,
      bottom: 124,
      height: 1,
      backgroundColor: D.borderFocus,
      opacity: 0.35,
    },
    heroContent: {
      position: 'absolute',
      bottom: 48,
      left: 24,
      right: 24,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      width: 176,
      height: 34,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: D.primaryLight,
      alignSelf: 'flex-start',
      marginBottom: 26,
      overflow: 'hidden',
    },
    badgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: D.primary,
    },
    badgeText: {
      fontSize: 14,
      fontFamily: T.family.extraBold,
      color: D.primary,
      letterSpacing: 0.8,
      lineHeight: 18,
    },
    heroTitle: {
      fontSize: 70,
      fontFamily: T.family.extraBold,
      color: D.ink,
      lineHeight: 70,
      marginBottom: 24,
    },
    heroDot: {
      color: D.primary,
    },
    heroSub: {
      fontSize: 17,
      fontFamily: T.family.regular,
      color: D.ink2,
      lineHeight: 25,
      maxWidth: 320,
    },

    // ── Form
    form: {
      paddingHorizontal: 22,
      paddingTop: 24,
      flex: 1,
      gap: 18,
    },
    fieldWrap: {
      gap: 6,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    fieldLabel: {
      fontSize: 15,
      fontFamily: T.family.bold,
      color: D.ink2,
    },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 62,
      borderRadius: 16,
      backgroundColor: D.card,
      borderWidth: 1,
      borderColor: D.border,
      paddingHorizontal: 18,
    },
    fieldError: {
      borderColor: D.accent,
    },
    fieldInput: {
      flex: 1,
      fontSize: 17,
      color: D.ink,
      fontFamily: T.family.bold,
    },
    forgotText: {
      fontSize: 12,
      fontFamily: T.family.semiBold,
      color: D.primary,
    },

    // ── Button
    btn: {
      height: 64,
      borderRadius: 18,
      backgroundColor: D.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 22,
      marginTop: 22,
    },
    btnDisabled: {
      opacity: 0.35,
    },
    btnText: {
      fontSize: 16,
      fontFamily: T.family.bold,
      color: D.onPrimary,
    },
    btnArrow: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: D.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Footer
    registerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    registerText: {
      fontSize: 14,
      fontFamily: T.family.regular,
      color: D.ink2,
    },
    registerLink: {
      fontSize: 14,
      fontFamily: T.family.bold,
      color: D.primary,
    },
    footer: {
      paddingBottom: 20,
      gap: 14,
      alignItems: 'center',
    },
    footerText: {
      fontSize: 12,
      fontFamily: T.family.regular,
      color: D.ink3,
    },
  });
}
