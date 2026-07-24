import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

import type { RootStackParamList } from '@app/types';
import { useAuth } from '@features/auth';
import { useAppTheme, type AppColors, typography as T } from '@shared/theme';

const { height: SCREEN_H } = Dimensions.get('window');
const HERO_H = Math.round(SCREEN_H * 0.38);

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors: D, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 42 : 16);
  const styles = useMemo(() => createStyles(D, isLight, bottomInset), [D, isLight, bottomInset]);
  const { signIn } = useAuth();
  const heroGradient = isLight
    ? {
        base: ['#F8FAFB', '#DFE0E2', '#D7EEF3', '#A2AEBB', '#EEF1F3'],
        overlay: ['rgba(223,224,226,0)', 'rgba(223,224,226,0.68)', '#DFE0E2'],
        warm: ['rgba(217,74,58,0.11)', 'rgba(217,74,58,0.03)', 'rgba(217,74,58,0)'],
        cold: ['rgba(35,181,211,0.26)', 'rgba(35,181,211,0.07)', 'rgba(35,181,211,0)'],
      }
    : {
        base: ['#0A0D0D', '#101916', '#31451F', '#151A12', '#0A0D0D'],
        overlay: ['rgba(10,13,13,0)', 'rgba(10,13,13,0.68)', '#0A0D0D'],
        warm: ['rgba(255,58,32,0.22)', 'rgba(255,58,32,0.06)', 'rgba(255,58,32,0)'],
        cold: ['rgba(47,111,126,0.22)', 'rgba(47,111,126,0.04)', 'rgba(47,111,126,0)'],
      };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  const isValidEmail = email.includes('@') && email.includes('.');
  const isValidPassword = password.length >= 6;
  const isValid = isValidEmail && isValidPassword;

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
            colors={heroGradient.base}
            locations={[0, 0.32, 0.58, 0.76, 1]}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.95 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={heroGradient.overlay}
            locations={[0, 0.72, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={heroGradient.warm}
            start={{ x: 0, y: 1 }}
            end={{ x: 0.7, y: 0.45 }}
            style={styles.heroWarmGradient}
          />
          <LinearGradient
            colors={heroGradient.cold}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 0.8, y: 0.65 }}
            style={styles.heroColdGradient}
          />
          <View style={styles.heroBadgeLine} />

          <View style={styles.heroContent}>
            <View style={styles.brandMark}>
              <View style={styles.brandMarkDot} />
              <View style={styles.brandMarkLine} />
            </View>

            <Text style={styles.heroTitle}>
              {'DETAIL'}
              <Text style={styles.heroDot}>{'·'}</Text>
              {'\nGO.'}
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
            <View
              testID="password-field"
              style={[styles.field, touched.password && !isValidPassword && styles.fieldError]}
            >
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
              <TouchableOpacity testID="toggle-password" onPress={() => setShowPassword(v => !v)}>
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
                <Text style={styles.btnText}>Entrar</Text>
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
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(D: AppColors, isLight: boolean, bottomInset: number) {
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
      backgroundColor: isLight ? D.surface : D.bg,
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
      bottom: 92,
      height: 1,
      backgroundColor: D.borderFocus,
      opacity: isLight ? 0.55 : 0.35,
    },
    heroContent: {
      position: 'absolute',
      bottom: 36,
      left: 24,
      right: 24,
    },
    brandMark: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      alignSelf: 'flex-start',
      marginBottom: 24,
    },
    brandMarkDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: D.primary,
    },
    brandMarkLine: {
      width: 124,
      height: 4,
      borderRadius: 999,
      backgroundColor: D.primary,
      opacity: isLight ? 0.48 : 0.34,
    },
    heroTitle: {
      fontSize: 62,
      fontFamily: T.family.extraBold,
      color: D.ink,
      lineHeight: 61,
    },
    heroDot: {
      color: D.primary,
    },

    // ── Form
    form: {
      paddingHorizontal: 22,
      paddingTop: 28,
      flex: 1,
      gap: 16,
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
      height: 58,
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
      height: 60,
      borderRadius: 18,
      backgroundColor: D.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 22,
      marginTop: 18,
    },
    btnDisabled: {
      opacity: isLight ? 0.48 : 0.35,
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
      backgroundColor: isLight ? 'rgba(255,255,255,0.28)' : D.primaryLight,
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
      paddingBottom: bottomInset + 12,
      alignItems: 'center',
    },
  });
}
