import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Store,
  User,
} from 'lucide-react-native';
import Geolocation from '@react-native-community/geolocation';

import type { RootStackParamList } from '@app/types';
import { useAuth } from '@features/auth';
import type { RegisterInput, UserRole } from '../services/auth.service';
import type { ShopLocation } from '@features/shops/domain/shopLocation.types';
import { useForm } from '@shared/hooks/useForm';
import { validationUtils, validationMessages } from '@shared/utils/validation.utils';
import { formatUtils } from '@shared/utils/format.utils';
import { useAppTheme, type AppColors, typography as T } from '@shared/theme';
import { generateGeohash, geocodeAddress } from '@shared/utils/geo.utils';
import { cepMask, cepOnlyDigits, fetchCep, formatCepAddress } from '@shared/utils/cep.utils';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type RegisterForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  shopName: string;
  shopCep: string;
  shopAddress: string;
  shopNumber: string;
  shopCity: string;
};

const ACCOUNT_TYPES = [
  {
    key: 'customer' as UserRole,
    label: 'Cliente',
    desc: 'Quero agendar serviços para o meu carro.',
    badge: 'GRÁTIS',
    Icon: User,
  },
  {
    key: 'owner' as UserRole,
    label: 'Dono de estética',
    desc: 'Tenho um negócio e quero gerenciar agenda.',
    badge: 'PRO · R$ 89/mês',
    Icon: Store,
  },
];

export default function RegisterScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors: D, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 42 : 16);
  const styles = useMemo(() => createStyles(D, bottomInset), [D, bottomInset]);
  const { register } = useAuth();

  const [accountType, setAccountType] = useState<UserRole | null>(null);
  const [displayPhone, setDisplayPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [shopLocation, setShopLocation] = useState<ShopLocation | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationStep, setLocationStep] = useState(false); // step 3 para owner
  const [displayCep, setDisplayCep] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);

  const validationRules = {
    firstName: [
      { validate: (v: string) => validationUtils.name(v), message: validationMessages.name },
      {
        validate: (v: string) => validationUtils.required(v),
        message: validationMessages.required,
      },
    ],
    lastName: [
      { validate: (v: string) => validationUtils.name(v), message: validationMessages.lastName },
      {
        validate: (v: string) => validationUtils.required(v),
        message: validationMessages.required,
      },
    ],
    email: [
      { validate: (v: string) => validationUtils.email(v), message: validationMessages.email },
      {
        validate: (v: string) => validationUtils.required(v),
        message: validationMessages.required,
      },
    ],
    phone: [
      { validate: (v: string) => validationUtils.phone(v), message: validationMessages.phone },
    ],
    password: [
      {
        validate: (v: string) => validationUtils.password(v),
        message: validationMessages.password,
      },
      {
        validate: (v: string) => validationUtils.required(v),
        message: validationMessages.required,
      },
    ],
    confirmPassword: [] as { validate: (v: string) => boolean; message: string }[],
    shopName: [],
    shopCep: [],
    shopAddress: [],
    shopNumber: [],
    shopCity: [],
  };

  const {
    values,
    errors,
    touched,
    isSubmitting,
    setIsSubmitting,
    handleChange,
    handleBlur,
    validateForm,
    reset,
  } = useForm<RegisterForm>(
    {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      shopName: '',
      shopCep: '',
      shopAddress: '',
      shopNumber: '',
      shopCity: '',
    },
    validationRules,
  );

  React.useEffect(() => {
    if (validationRules.confirmPassword.length === 0) {
      validationRules.confirmPassword.push({
        validate: (v: string) => validationUtils.confirmPassword(values.password, v),
        message: validationMessages.confirmPassword,
      });
    }
    // Mantem o comportamento existente do useForm: registrar a regra apenas uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.password]);

  const canSubmit = useMemo(() => {
    if (!accountType) return false;
    const baseOk =
      Object.keys(errors).length === 0 &&
      values.firstName &&
      values.lastName &&
      values.email &&
      values.password &&
      values.confirmPassword &&
      !isSubmitting;
    return !!baseOk;
  }, [errors, values, isSubmitting, accountType]);

  const handlePhoneChange = (text: string) => {
    setDisplayPhone(formatUtils.phoneMask(text));
    handleChange('phone', formatUtils.phoneDigits(text));
  };

  const handleCepChange = async (text: string) => {
    const masked = cepMask(text);
    setDisplayCep(masked);
    const digits = cepOnlyDigits(text);
    handleChange('shopCep', digits);

    if (digits.length === 8) {
      setLoadingCep(true);
      const result = await fetchCep(digits);
      setLoadingCep(false);

      if (result) {
        const { address, city } = formatCepAddress(result);
        handleChange('shopAddress', address);
        handleChange('shopCity', city);
      } else {
        Alert.alert('CEP não encontrado', 'Verifique o CEP e preencha o endereço manualmente.');
      }
    }
  };

  /**
   * Pede permissão de localização no Android.
   * No iOS o @react-native-community/geolocation pede automaticamente.
   */
  const ensureLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Permissão de localização',
          message: 'Precisamos da sua localização para registrar o endereço da estética.',
          buttonNeutral: 'Perguntar depois',
          buttonNegative: 'Não permitir',
          buttonPositive: 'Permitir',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  /**
   * Usa o GPS para definir a localização da estética.
   * O texto exibido vem dos campos preenchidos pelo CEP (ou "Localização atual").
   */
  const handleUseCurrentLocation = async () => {
    setLoadingLocation(true);

    const hasPermission = await ensureLocationPermission();
    if (!hasPermission) {
      setLoadingLocation(false);
      Alert.alert('Permissão negada', 'Não foi possível acessar sua localização.');
      return;
    }

    Geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        const address = values.shopAddress.trim();
        const number = values.shopNumber.trim();
        const addressWithNumber = number ? `${address}, ${number}` : address || 'Localização atual';
        setShopLocation({
          lat: latitude,
          lng: longitude,
          address: addressWithNumber,
          city: values.shopCity.trim() || '',
          geohash: generateGeohash(latitude, longitude),
        });
        setLoadingLocation(false);
        Alert.alert('Localização obtida!', 'Sua posição atual foi salva.');
      },
      err => {
        setLoadingLocation(false);
        Alert.alert(
          'GPS indisponível',
          `${err?.message ?? 'Erro desconhecido'}\n\nVerifique se o GPS está ativado.`,
        );
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 },
    );
  };

  /**
   * Confirma o endereço. Usa GPS para coordenadas precisas e mantém o texto
   * preenchido pelo CEP. Se o GPS falhar, tenta Nominatim como fallback.
   */
  const handleGeocodeAddress = async () => {
    const address = values.shopAddress.trim();
    const number = values.shopNumber.trim();
    const city = values.shopCity.trim();

    if (!address && !city) {
      Alert.alert('Atenção', 'Preencha o CEP ou o endereço da estética.');
      return;
    }

    setLoadingLocation(true);

    const hasPermission = await ensureLocationPermission();
    if (!hasPermission) {
      setLoadingLocation(false);
      Alert.alert(
        'Permissão necessária',
        'Para confirmar o endereço, permita o acesso à localização nas configurações.',
      );
      return;
    }

    Geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        const addressWithNumber = number ? `${address}, ${number}` : address;
        setShopLocation({
          lat: latitude,
          lng: longitude,
          address: addressWithNumber,
          city,
          geohash: generateGeohash(latitude, longitude),
        });
        setLoadingLocation(false);
        Alert.alert('Localização confirmada', `${addressWithNumber}\n${city}`);
      },
      async err => {
        // Fallback: tenta geocodificar via Nominatim
        const fullAddress = [address, number, city, 'Brasil'].filter(Boolean).join(', ');
        const coords = await geocodeAddress(fullAddress);

        if (coords) {
          const addressWithNumber = number ? `${address}, ${number}` : address;
          setShopLocation({
            lat: coords.lat,
            lng: coords.lng,
            address: addressWithNumber,
            city,
            geohash: generateGeohash(coords.lat, coords.lng),
          });
          setLoadingLocation(false);
          Alert.alert('Localização confirmada', `${addressWithNumber}\n${city}`);
          return;
        }

        setLoadingLocation(false);
        Alert.alert(
          'Não foi possível obter a localização',
          `GPS: ${err?.message ?? 'falhou'}\n\nVerifique se o GPS está ativado.`,
        );
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 },
    );
  };

  const handleSubmit = async () => {
    if (!accountType || !validateForm()) return;

    // Owner precisa de localização
    if (accountType === 'owner' && !shopLocation) {
      Alert.alert(
        'Localização necessária',
        'Informe onde fica sua estética para aparecer no mapa.',
      );
      return;
    }

    setIsSubmitting(true);
    const data: RegisterInput = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim(),
      phone: values.phone,
      password: values.password,
      role: accountType,
      shopName: accountType === 'owner' ? values.shopName.trim() || 'Minha Estética' : undefined,
      shopLocation: accountType === 'owner' ? shopLocation ?? undefined : undefined,
    };

    const res = await register(data);
    setIsSubmitting(false);

    if (!res.ok) {
      Alert.alert('Erro', res.message ?? 'Falha ao cadastrar');
      return;
    }

    reset();
    setDisplayPhone('');
    setShopLocation(null);
    setLocationStep(false);
    setAccountType(null);

    if (accountType === 'owner') {
      Alert.alert(
        '🎉 Estética criada!',
        'Sua estética foi cadastrada com sucesso!\n\nAtive sua assinatura para aparecer no mapa e receber clientes.',
        [{ text: 'Entendido!' }],
      );
    } else {
      Alert.alert(
        '🎉 Conta criada!',
        'Bem-vindo ao DetailGo!\n\nExplore as estéticas parceiras no mapa e agende seu serviço.',
        [{ text: 'Vamos lá!' }],
      );
    }
  };

  // ── Step 1: Seleção de tipo ────────────────────────────────
  if (!accountType) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header */}
          <View style={styles.step1Header}>
            <Text style={styles.stepIndicator}>01 / 02 · TIPO</Text>
            <Text style={styles.step1Title}>Como você usa o DetailGo?</Text>
            <Text style={styles.step1Sub}>Escolha um perfil para começar.</Text>
          </View>

          {/* Cards */}
          <View style={styles.typeCards}>
            {ACCOUNT_TYPES.map(type => {
              const sel = accountType === type.key;
              return (
                <TouchableOpacity
                  key={type.key}
                  style={[styles.typeCard, sel && styles.typeCardSel]}
                  onPress={() => setAccountType(type.key)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.typeIconWrap, sel && styles.typeIconWrapSel]}>
                    <type.Icon size={20} color={sel ? D.onPrimary : D.ink} />
                  </View>
                  <View style={styles.typeCardBody}>
                    <View style={styles.typeCardTop}>
                      <Text style={[styles.typeCardLabel, sel && styles.typeCardLabelSel]}>
                        {type.label}
                      </Text>
                      <Text style={styles.typeCardBadge}>{type.badge}</Text>
                    </View>
                    <Text style={styles.typeCardDesc}>{type.desc}</Text>
                  </View>
                  <View style={[styles.typeRadio, sel && styles.typeRadioSel]}>
                    {sel && <CheckCircle2 size={14} color={D.onPrimary} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Trial notice */}
          <View style={styles.trialBox}>
            <Text style={styles.trialLabel}>TRIAL 7 DIAS</Text>
            <Text style={styles.trialDesc}>
              Donos começam com 7 dias grátis no mapa. Após isso, assine para continuar visível.
            </Text>
          </View>

          {/* Login link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Já tem conta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Fazer login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const isOwner = accountType === 'owner';

  // ── Step 3: Localização da estética (owner) ────────────────
  if (isOwner && locationStep) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.step2Header}>
            <Text style={styles.stepIndicator}>03 / 03 · LOCALIZAÇÃO</Text>
            <Text style={styles.step2Title}>{'Onde fica\nsua estética?'}</Text>
            <TouchableOpacity style={styles.typePill} onPress={() => setLocationStep(false)}>
              <ArrowLeft size={12} color={D.primary} />
              <Text style={styles.typePillText}>Voltar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fields}>
            {/* CEP com busca automática */}
            <View style={styles.cepRow}>
              <DField
                label="CEP"
                icon={
                  loadingCep ? (
                    <ActivityIndicator size="small" color={D.primary} />
                  ) : (
                    <MapPin size={18} color={D.ink3} />
                  )
                }
                value={displayCep}
                onChangeText={handleCepChange}
                onBlur={() => handleBlur('shopCep')}
                placeholder="00000-000"
                keyboardType="numeric"
                maxLength={9}
                containerStyle={styles.cepField}
                error={undefined}
              />
              {loadingCep && (
                <View style={styles.cepBadge}>
                  <Text style={styles.cepBadgeText}>Buscando...</Text>
                </View>
              )}
            </View>

            <DField
              label="ENDEREÇO"
              icon={<MapPin size={18} color={D.ink3} />}
              value={values.shopAddress}
              onChangeText={v => handleChange('shopAddress', v)}
              onBlur={() => handleBlur('shopAddress')}
              placeholder="Rua, bairro (preenchido pelo CEP)"
              error={touched.shopAddress ? errors.shopAddress : undefined}
            />

            <DField
              label="NÚMERO"
              icon={<MapPin size={18} color={D.ink3} />}
              value={values.shopNumber}
              onChangeText={v => handleChange('shopNumber', v)}
              onBlur={() => handleBlur('shopNumber')}
              placeholder="Ex: 123, S/N"
              keyboardType="default"
              error={touched.shopNumber ? errors.shopNumber : undefined}
            />
            <DField
              label="CIDADE"
              icon={<MapPin size={18} color={D.ink3} />}
              value={values.shopCity}
              onChangeText={v => handleChange('shopCity', v)}
              onBlur={() => handleBlur('shopCity')}
              placeholder="Cidade - UF (preenchido pelo CEP)"
              error={touched.shopCity ? errors.shopCity : undefined}
            />

            {/* Botão confirmar com GPS */}
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: D.surface }]}
              onPress={handleGeocodeAddress}
              disabled={loadingLocation}
              activeOpacity={0.85}
            >
              {loadingLocation ? (
                <ActivityIndicator color={D.primary} />
              ) : (
                <>
                  <Navigation size={16} color={D.primary} />
                  <Text style={[styles.btnText, { color: D.primary }]}>Confirmar com GPS</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Botão GPS */}
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: D.primaryLight }]}
              onPress={handleUseCurrentLocation}
              disabled={loadingLocation}
              activeOpacity={0.85}
            >
              {loadingLocation ? (
                <ActivityIndicator color={D.primary} />
              ) : (
                <>
                  <Navigation size={18} color={D.primary} />
                  <Text style={[styles.btnText, { color: D.primary }]}>
                    Usar minha localização atual
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Confirmação */}
            {shopLocation && (
              <View style={styles.locationConfirmed}>
                <CheckCircle2 size={16} color={D.primary} />
                <Text style={styles.locationConfirmedText}>
                  Localização definida · {shopLocation.address || shopLocation.city}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.cta}>
            <TouchableOpacity
              style={[styles.btn, (!shopLocation || isSubmitting) && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={!shopLocation || isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color={D.onPrimary} />
              ) : (
                <>
                  <Text style={styles.btnText}>Criar estética e conta</Text>
                  <View style={styles.btnArrow}>
                    <ArrowRight size={18} color={D.onPrimary} />
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Step 2: Formulário ─────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header */}
        <View style={styles.step2Header}>
          <Text style={styles.stepIndicator}>02 / 02 · CADASTRO</Text>
          <Text style={styles.step2Title}>{isOwner ? 'Cadastrar\nestética' : 'Criar\nconta'}</Text>

          {/* Type switcher pill */}
          <TouchableOpacity style={styles.typePill} onPress={() => setAccountType(null)}>
            <ArrowLeft size={12} color={D.primary} />
            <Text style={styles.typePillText}>
              {isOwner ? 'Dono de estética' : 'Cliente'} · trocar
            </Text>
          </TouchableOpacity>
        </View>

        {/* Campos */}
        <View style={styles.fields}>
          {isOwner && (
            <DField
              label="NOME DA ESTÉTICA"
              icon={<Store size={18} color={D.ink3} />}
              value={values.shopName}
              onChangeText={v => handleChange('shopName', v)}
              onBlur={() => handleBlur('shopName')}
              placeholder="Ex: Tirac Auto Detailing"
              error={touched.shopName ? errors.shopName : undefined}
            />
          )}

          <View style={styles.row}>
            <DField
              label="NOME"
              icon={<User size={18} color={D.ink3} />}
              value={values.firstName}
              onChangeText={v => handleChange('firstName', v)}
              onBlur={() => handleBlur('firstName')}
              placeholder="Nome"
              error={touched.firstName ? errors.firstName : undefined}
              containerStyle={styles.col}
            />
            <DField
              label="SOBRENOME"
              icon={<User size={18} color={D.ink3} />}
              value={values.lastName}
              onChangeText={v => handleChange('lastName', v)}
              onBlur={() => handleBlur('lastName')}
              placeholder="Sobrenome"
              error={touched.lastName ? errors.lastName : undefined}
              containerStyle={styles.col}
            />
          </View>

          <DField
            label="E-MAIL"
            icon={<Mail size={18} color={D.ink3} />}
            value={values.email}
            onChangeText={v => handleChange('email', v)}
            onBlur={() => handleBlur('email')}
            placeholder="seu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={touched.email ? errors.email : undefined}
          />

          <DField
            label="TELEFONE"
            icon={<Phone size={18} color={D.ink3} />}
            value={displayPhone}
            onChangeText={handlePhoneChange}
            onBlur={() => handleBlur('phone')}
            placeholder="(11) 91234-5678"
            keyboardType="phone-pad"
            maxLength={15}
            error={touched.phone ? errors.phone : undefined}
          />

          <DField
            label="SENHA"
            icon={<Lock size={18} color={D.ink3} />}
            value={values.password}
            onChangeText={v => handleChange('password', v)}
            onBlur={() => handleBlur('password')}
            placeholder="mínimo 6 caracteres"
            secureTextEntry={!showPassword}
            error={touched.password ? errors.password : undefined}
            trailing={
              <TouchableOpacity onPress={() => setShowPassword(v => !v)}>
                {showPassword ? (
                  <EyeOff size={18} color={D.ink3} />
                ) : (
                  <Eye size={18} color={D.ink3} />
                )}
              </TouchableOpacity>
            }
          />

          <DField
            label="CONFIRMAR SENHA"
            icon={<Lock size={18} color={D.ink3} />}
            value={values.confirmPassword}
            onChangeText={v => handleChange('confirmPassword', v)}
            onBlur={() => handleBlur('confirmPassword')}
            placeholder="repita a senha"
            secureTextEntry={!showConfirm}
            error={touched.confirmPassword ? errors.confirmPassword : undefined}
            trailing={
              <TouchableOpacity onPress={() => setShowConfirm(v => !v)}>
                {showConfirm ? (
                  <EyeOff size={18} color={D.ink3} />
                ) : (
                  <Eye size={18} color={D.ink3} />
                )}
              </TouchableOpacity>
            }
          />
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          <TouchableOpacity
            style={[styles.btn, (!canSubmit || isSubmitting) && styles.btnDisabled]}
            onPress={
              isOwner
                ? () => {
                    if (validateForm()) setLocationStep(true);
                  }
                : handleSubmit
            }
            disabled={!canSubmit || isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color={D.onPrimary} />
            ) : (
              <>
                <Text style={styles.btnText}>
                  {isOwner ? 'Próximo · Localização' : 'Criar conta'}
                </Text>
                <View style={styles.btnArrow}>
                  <ArrowRight size={18} color={D.onPrimary} />
                </View>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Já tem conta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Fazer login</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Dark Field Component ───────────────────────────────────────
function DField({
  label,
  icon,
  value,
  onChangeText,
  onBlur,
  placeholder,
  error,
  trailing,
  keyboardType,
  autoCapitalize,
  maxLength,
  secureTextEntry,
  containerStyle,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChangeText: (v: string) => void;
  onBlur: () => void;
  placeholder: string;
  error?: string;
  trailing?: React.ReactNode;
  keyboardType?: any;
  autoCapitalize?: any;
  maxLength?: number;
  secureTextEntry?: boolean;
  containerStyle?: any;
}) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);

  return (
    <View style={[styles.fieldWrap, containerStyle]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.field, !!error && styles.fieldError]}>
        {icon}
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={D.ink3}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || 'words'}
          autoCorrect={false}
          maxLength={maxLength}
          secureTextEntry={secureTextEntry}
          editable
        />
        {trailing}
      </View>
      {!!error && <Text style={styles.fieldErrorText}>{error}</Text>}
    </View>
  );
}

function createStyles(D: AppColors, bottomInset = 0) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: D.bg,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: 22,
      paddingTop: 60,
      paddingBottom: 24 + bottomInset,
    },

    // ── Step 1
    step1Header: {
      marginBottom: 28,
    },
    stepIndicator: {
      fontSize: 10,
      fontFamily: T.family.semiBold,
      color: D.ink3,
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    step1Title: {
      fontSize: 26,
      fontFamily: T.family.bold,
      color: D.ink,
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    step1Sub: {
      fontSize: 14,
      fontFamily: T.family.regular,
      color: D.ink2,
      lineHeight: 20,
    },
    typeCards: {
      gap: 10,
      marginBottom: 16,
    },
    typeCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 16,
      borderRadius: 16,
      backgroundColor: D.card,
      borderWidth: 1,
      borderColor: D.border,
    },
    typeCardSel: {
      backgroundColor: D.primaryLight,
      borderColor: D.primary,
    },
    typeIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: D.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeIconWrapSel: {
      backgroundColor: D.primary,
    },
    typeCardBody: {
      flex: 1,
    },
    typeCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    typeCardLabel: {
      fontSize: 16,
      fontFamily: T.family.semiBold,
      color: D.ink,
    },
    typeCardLabelSel: {
      color: D.ink,
    },
    typeCardBadge: {
      fontSize: 9,
      fontFamily: T.family.semiBold,
      color: D.primary,
      letterSpacing: 0.5,
    },
    typeCardDesc: {
      fontSize: 12,
      fontFamily: T.family.regular,
      color: D.ink2,
      lineHeight: 18,
    },
    typeRadio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: D.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    typeRadioSel: {
      backgroundColor: D.primary,
      borderColor: D.primary,
    },
    trialBox: {
      padding: 14,
      backgroundColor: D.primaryLight,
      borderWidth: 1,
      borderColor: D.border,
      borderStyle: 'dashed',
      borderRadius: 12,
      marginBottom: 24,
    },
    trialLabel: {
      fontSize: 10,
      fontFamily: T.family.semiBold,
      color: D.ink3,
      letterSpacing: 0.5,
      marginBottom: 5,
    },
    trialDesc: {
      fontSize: 12,
      fontFamily: T.family.regular,
      color: D.ink2,
      lineHeight: 18,
    },

    // ── Step 2
    step2Header: {
      marginBottom: 24,
    },
    step2Title: {
      fontSize: 30,
      fontFamily: T.family.bold,
      color: D.ink,
      letterSpacing: -0.8,
      lineHeight: 32,
      marginBottom: 12,
      marginTop: 8,
    },
    typePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: D.primaryLight,
      borderWidth: 1,
      borderColor: D.borderFocus,
    },
    typePillText: {
      fontSize: 11,
      fontFamily: T.family.semiBold,
      color: D.primary,
    },

    // ── Fields
    fields: {
      gap: 12,
      marginBottom: 24,
    },
    row: {
      flexDirection: 'row',
      gap: 10,
    },
    col: {
      flex: 1,
    },
    fieldWrap: {
      gap: 5,
    },
    fieldLabel: {
      fontSize: 10,
      fontFamily: T.family.semiBold,
      color: D.ink3,
      letterSpacing: 0.5,
    },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 50,
      borderRadius: 12,
      backgroundColor: D.card,
      borderWidth: 1,
      borderColor: D.border,
      paddingHorizontal: 14,
    },
    fieldError: {
      borderColor: D.accent,
    },
    fieldInput: {
      flex: 1,
      fontSize: 14,
      color: D.ink,
      fontFamily: T.family.medium,
    },
    fieldErrorText: {
      fontSize: 11,
      fontFamily: T.family.regular,
      color: D.accent,
      marginTop: 2,
    },

    // ── CEP
    cepRow: {
      position: 'relative',
    },
    cepField: {
      flex: 1,
    },
    cepBadge: {
      position: 'absolute',
      right: 12,
      top: 28,
      height: 50,
      justifyContent: 'center',
    },
    cepBadgeText: {
      fontSize: 11,
      color: D.primary,
      fontFamily: T.family.semiBold,
    },

    // ── Location confirmed
    locationConfirmed: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      backgroundColor: D.primaryLight,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: D.borderFocus,
    },
    locationConfirmedText: {
      flex: 1,
      fontSize: 13,
      color: D.primary,
      fontFamily: T.family.medium,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginVertical: 4,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: D.border,
    },
    dividerText: {
      fontSize: 12,
      color: D.ink3,
      fontFamily: T.family.medium,
    },

    // ── CTA
    cta: {
      gap: 16,
    },
    btn: {
      height: 54,
      borderRadius: 14,
      backgroundColor: D.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 22,
    },
    btnDisabled: {
      opacity: 0.35,
    },
    btnText: {
      fontSize: 15,
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
    loginRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loginText: {
      fontSize: 14,
      fontFamily: T.family.regular,
      color: D.ink2,
    },
    loginLink: {
      fontSize: 14,
      fontFamily: T.family.bold,
      color: D.primary,
    },
  });
}
