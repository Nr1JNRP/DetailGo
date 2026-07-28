import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useFeedback } from '@shared/components/FeedbackProvider';
import { generateGeohash, geocodeAddress, reverseGeocode } from '@shared/utils/geo.utils';
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
  const { showError, showSuccess } = useFeedback();

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
    confirmPassword: [
      {
        validate: (v: string) => validationUtils.required(v),
        message: validationMessages.required,
      },
    ],
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

  // Habilita o botão quando os campos obrigatórios estão preenchidos. A
  // validação (incl. senhas conferem) roda no clique — não travamos o botão por
  // causa de erros, senão ele "morre" (o useForm mantém chaves de erro com
  // valor undefined, e o disabled bloquearia o próximo toque).
  const canSubmit = useMemo(() => {
    if (!accountType) return false;
    const baseOk =
      values.firstName &&
      values.lastName &&
      values.email &&
      values.password &&
      values.confirmPassword &&
      !isSubmitting;
    return !!baseOk;
  }, [values, isSubmitting, accountType]);

  // Checagem explícita de senhas iguais — lê os valores atuais (o handler é
  // recriado a cada render) e dá feedback garantido por modal.
  const ensurePasswordsMatch = (): boolean => {
    if (values.password !== values.confirmPassword) {
      showError('As senhas não conferem. Verifique e tente de novo.', {
        title: 'Senhas diferentes',
      });
      return false;
    }
    return true;
  };

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
        showError('Verifique o CEP e preencha o endereço manualmente.', {
          title: 'CEP não encontrado',
        });
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
      showError('Não foi possível acessar sua localização.', { title: 'Permissão negada' });
      return;
    }

    Geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        const geohash = generateGeohash(latitude, longitude);

        // Reverse geocode para preencher endereço e cidade
        const reversed = await reverseGeocode({ lat: latitude, lng: longitude });

        if (reversed?.address) handleChange('shopAddress', reversed.address);
        if (reversed?.city) handleChange('shopCity', reversed.city);
        if (reversed?.cep) {
          handleChange('shopCep', reversed.cep);
          setDisplayCep(cepMask(reversed.cep));
        }

        const addressLabel = reversed?.address || values.shopAddress.trim() || 'Localização atual';
        const cityLabel = reversed?.city || values.shopCity.trim() || '';

        setShopLocation({
          lat: latitude,
          lng: longitude,
          address: addressLabel,
          city: cityLabel,
          geohash,
        });
        setLoadingLocation(false);
        showSuccess(`${addressLabel}${cityLabel ? `\n${cityLabel}` : ''}`, {
          title: 'Localização obtida!',
        });
      },
      err => {
        setLoadingLocation(false);
        showError(`${err?.message ?? 'Erro desconhecido'}\n\nVerifique se o GPS está ativado.`, {
          title: 'GPS indisponível',
        });
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 },
    );
  };

  /**
   * Geocodifica o endereço digitado via Nominatim e salva as coordenadas do shop.
   * Tenta múltiplas variações da query para contornar limitações do Nominatim com
   * formatos de endereço brasileiro (ex: "Cidade - UF", bairro junto ao logradouro).
   */
  const handleGeocodeAddress = async () => {
    const address = values.shopAddress.trim();
    const number = values.shopNumber.trim();
    const city = values.shopCity.trim();

    if (!address && !city) {
      showError('Preencha o CEP ou o endereço da estética.', { title: 'Atenção' });
      return;
    }

    setLoadingLocation(true);

    // Normaliza cidade: "Barueri - SP" → "Barueri, SP"
    const cityNorm = city.replace(/\s*-\s*/, ', ');
    // Extrai apenas o nome da cidade (antes do " - ")
    const cityOnly = city.split(/\s*-\s*/)[0].trim();
    // Extrai apenas o logradouro (antes de qualquer vírgula — remove bairro)
    const streetOnly = address.split(',')[0].trim();
    const addressWithNumber = number ? `${address}, ${number}` : address;

    // Estratégias em ordem decrescente de especificidade
    const queries = [
      [streetOnly, number, cityNorm, 'Brasil'].filter(Boolean).join(', '),
      [streetOnly, cityNorm, 'Brasil'].filter(Boolean).join(', '),
      [streetOnly, cityOnly, 'Brasil'].filter(Boolean).join(', '),
      [address, cityOnly, 'Brasil'].filter(Boolean).join(', '),
    ];

    let coords = null;
    for (const query of queries) {
      coords = await geocodeAddress(query);
      if (coords) break;
    }

    if (coords) {
      setShopLocation({
        lat: coords.lat,
        lng: coords.lng,
        address: addressWithNumber,
        city,
        geohash: generateGeohash(coords.lat, coords.lng),
      });
      setLoadingLocation(false);
      showSuccess(`${addressWithNumber}\n${city}`, { title: 'Localização confirmada' });
      return;
    }

    setLoadingLocation(false);
    showError(
      'Não foi possível localizar o endereço. Verifique os dados ou use "Usar minha localização atual" estando no local da estética.',
      { title: 'Endereço não encontrado' },
    );
  };

  const handleSubmit = async () => {
    if (!accountType) return;
    if (!ensurePasswordsMatch()) return;
    if (!validateForm()) return;

    // Owner precisa de localização
    if (accountType === 'owner' && !shopLocation) {
      showError('Informe onde fica sua estética para aparecer no mapa.', {
        title: 'Localização necessária',
      });
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
      showError(res.message ?? 'Falha ao cadastrar');
      return;
    }

    reset();
    setDisplayPhone('');
    setShopLocation(null);
    setLocationStep(false);
    setAccountType(null);

    if (accountType === 'owner') {
      showSuccess(
        'Sua estética foi cadastrada com sucesso!\n\nVocê tem 7 dias grátis para usar o app. Após isso, ative sua assinatura para continuar visível no mapa.',
        { title: 'Estética criada!', primaryLabel: 'Entendido!' },
      );
    } else {
      showSuccess(
        'Bem-vindo ao DetailGo!\n\nExplore as estéticas parceiras no mapa e agende seu serviço.',
        { title: '🎉 Conta criada!', primaryLabel: 'Vamos lá!' },
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

  // -- Step 3: Localizacao da estetica (owner)
  if (isOwner && locationStep) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />
        <View style={styles.locationFormContent}>
          <View style={styles.locationHeader}>
            <View style={styles.locationTopBar}>
              <TouchableOpacity
                style={styles.locationBackButton}
                onPress={() => setLocationStep(false)}
              >
                <ArrowLeft size={21} color={D.ink} strokeWidth={2.3} />
              </TouchableOpacity>

              <Text style={styles.locationTitle} numberOfLines={2}>
                Onde fica sua estética?
              </Text>
            </View>
          </View>

          <View style={styles.locationFields}>
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

            {/* Botão confirmar endereço */}
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: D.surface, justifyContent: 'center' }]}
              onPress={handleGeocodeAddress}
              disabled={loadingLocation}
              activeOpacity={0.85}
            >
              {loadingLocation ? (
                <ActivityIndicator color={D.primary} />
              ) : (
                <Text style={[styles.btnText, { color: D.primary, textAlign: 'center' }]}>
                  Confirmar endereço
                </Text>
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

          <View style={styles.locationCta}>
            <TouchableOpacity
              style={[
                styles.btn,
                { justifyContent: 'center' },
                (!shopLocation || isSubmitting) && styles.btnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!shopLocation || isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color={D.onPrimary} />
              ) : (
                <Text style={styles.btnText}>Criar estética e conta</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
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
      <View style={styles.formContent}>
        {/* Header */}
        <View style={styles.step2Header}>
          <View style={styles.registerTopBar}>
            <TouchableOpacity
              style={styles.registerBackButton}
              onPress={() => setAccountType(null)}
            >
              <ArrowLeft size={21} color={D.ink} strokeWidth={2.3} />
            </TouchableOpacity>

            <Text style={styles.step2Title} numberOfLines={1}>
              {isOwner ? 'Cadastrar estética' : 'Criar conta'}
            </Text>

            <View style={styles.registerHeaderSpacer} />
          </View>
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
            testID="register-submit"
            style={[styles.btn, (!canSubmit || isSubmitting) && styles.btnDisabled]}
            onPress={
              isOwner
                ? () => {
                    if (ensurePasswordsMatch() && validateForm()) setLocationStep(true);
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
      </View>
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
    formContent: {
      flex: 1,
      paddingHorizontal: 22,
      paddingTop: 42,
      paddingBottom: 14 + bottomInset,
    },
    locationFormContent: {
      flex: 1,
      paddingHorizontal: 22,
      paddingTop: 42,
      paddingBottom: 14 + bottomInset,
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
      marginBottom: 34,
    },
    registerTopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    registerBackButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: D.surface,
      borderWidth: 1,
      borderColor: D.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    registerHeaderSpacer: {
      width: 44,
      height: 44,
    },
    step2Title: {
      flex: 1,
      fontSize: 27,
      fontFamily: T.family.bold,
      color: D.ink,
      letterSpacing: -0.8,
      lineHeight: 32,
      marginBottom: 0,
      marginTop: 0,
      textAlign: 'center',
    },
    locationHeader: {
      marginBottom: 26,
    },
    locationTopBar: {
      minHeight: 62,
      justifyContent: 'center',
      position: 'relative',
    },
    locationBackButton: {
      position: 'absolute',
      left: 0,
      top: 9,
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: D.surface,
      borderWidth: 1,
      borderColor: D.border,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    locationTitle: {
      fontSize: 25,
      fontFamily: T.family.bold,
      color: D.ink,
      letterSpacing: -0.6,
      lineHeight: 29,
      textAlign: 'center',
      paddingHorizontal: 54,
    },
    typePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: D.primaryLight,
      borderWidth: 1,
      borderColor: D.borderFocus,
    },
    typePillText: {
      fontSize: 12,
      fontFamily: T.family.semiBold,
      color: D.primary,
    },

    // ── Fields
    fields: {
      gap: 7,
      marginBottom: 18,
    },
    locationFields: {
      gap: 7,
      marginBottom: 14,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
    },
    col: {
      flex: 1,
    },
    fieldWrap: {
      gap: 3,
    },
    fieldLabel: {
      fontSize: 9,
      fontFamily: T.family.semiBold,
      color: D.ink3,
      letterSpacing: 0.5,
    },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      height: 48,
      borderRadius: 12,
      backgroundColor: D.card,
      borderWidth: 1,
      borderColor: D.border,
      paddingHorizontal: 12,
    },
    fieldError: {
      borderColor: D.accent,
    },
    fieldInput: {
      flex: 1,
      fontSize: 13,
      color: D.ink,
      fontFamily: T.family.medium,
    },
    fieldErrorText: {
      fontSize: 10,
      fontFamily: T.family.regular,
      color: D.accent,
      marginTop: 2,
    },

    // ── CEP
    cepRow: {
      position: 'relative',
    },
    cepField: {
      width: '100%',
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
      gap: 10,
      marginTop: 'auto',
    },
    locationCta: {
      gap: 10,
      marginTop: 'auto',
      paddingTop: 12,
    },
    btn: {
      height: 50,
      borderRadius: 14,
      backgroundColor: D.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
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
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: D.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loginRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 28,
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
