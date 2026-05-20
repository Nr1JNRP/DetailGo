import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Check, ChevronRight, Moon, RefreshCw, Sun, X } from 'lucide-react-native';

import { getAuth } from '@react-native-firebase/auth';
import {
  getFirestore,
  doc,
  updateDoc,
  deleteField,
  onSnapshot,
} from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

import { typography as T, useAppTheme, type AppColors } from '@shared/theme';
import type { RootStackParamList } from '@app/types';
import { formatUtils } from '@shared/utils/format.utils';
import { useAuth } from '@features/auth';
import { useShop } from '@features/shops';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

type UserProfile = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  photoB64?: string;
  pendingEmail?: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function toDigits(value: string) {
  return (value || '').replace(/\D/g, '');
}

export default function ProfileScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors: D, isLight, toggleTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);
  const db = getFirestore();
  const authInstance = getAuth();
  const user = authInstance.currentUser;
  const { signOut } = useAuth();
  const { shop, loading: loadingShop } = useShop();

  const uid = user?.uid ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingConfirm, setCheckingConfirm] = useState(false);

  const [profile, setProfile] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    email: user?.email || '',
    phone: '',
    pendingEmail: '',
    photoURL: user?.photoURL ?? undefined,
  });

  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [updatingEmail, setUpdatingEmail] = useState(false);

  const [editingPhone, setEditingPhone] = useState(false);
  const [displayPhone, setDisplayPhone] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const userRef = useMemo(() => {
    if (!uid) return null;
    return doc(db, 'users', uid);
  }, [db, uid]);

  const displayName = useMemo(() => {
    const profileName = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim();
    return profileName || user?.displayName || 'Cliente DetailGo';
  }, [profile.firstName, profile.lastName, user?.displayName]);

  const initials = useMemo(() => {
    const source = displayName.trim() || user?.email || 'Cliente';
    return source
      .split(' ')
      .filter(Boolean)
      .map(word => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [displayName, user?.email]);

  const avatarSource = profile.photoB64
    ? { uri: profile.photoB64 }
    : profile.photoURL
    ? { uri: profile.photoURL }
    : null;

  const linkedShopName = loadingShop ? 'Carregando...' : shop?.name ?? 'Não vinculada';

  useEffect(() => {
    if (!userRef || !user) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(userRef, snap => {
      const data = (snap.data() as UserProfile | undefined) ?? {};

      const authEmail = user.email || '';
      const pendingFromFirestore = data.pendingEmail || '';

      const shouldClearPending =
        pendingFromFirestore && normalizeEmail(authEmail) === normalizeEmail(pendingFromFirestore);

      const phoneValue = data.phone || '';

      setProfile({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        phone: phoneValue,
        email: authEmail || data.email || '',
        pendingEmail: shouldClearPending ? '' : pendingFromFirestore,
        photoURL: data.photoURL || user.photoURL || undefined,
        photoB64: data.photoB64,
      });

      setNewPhone(phoneValue);
      setDisplayPhone(formatUtils.phoneMask(phoneValue));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userRef, user]);

  const handleSave = async () => {
    if (!userRef) return;

    if (!profile.firstName?.trim() || !profile.lastName?.trim()) {
      Alert.alert('Atenção', 'Nome e sobrenome são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(userRef, {
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
      });

      setEditingName(false);
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar o perfil');
    } finally {
      setSaving(false);
    }
  };

  const handlePhoneSave = async () => {
    if (!userRef) return;

    const cleanPhone = toDigits(newPhone || '');
    if (newPhone && cleanPhone.length < 10) {
      Alert.alert('Atenção', 'Telefone inválido');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(userRef, {
        phone: cleanPhone,
      });

      setProfile(prev => ({ ...prev, phone: cleanPhone }));
      setEditingPhone(false);
      Alert.alert('Sucesso', 'Telefone atualizado com sucesso!');
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar o telefone');
    } finally {
      setSaving(false);
    }
  };

  const handlePhoneChange = (text: string) => {
    const masked = formatUtils.phoneMask(text);
    setDisplayPhone(masked);
    const digits = formatUtils.phoneDigits(text);
    setNewPhone(digits);
  };

  const cancelPhoneEdit = () => {
    setEditingPhone(false);
    setDisplayPhone(formatUtils.phoneMask(profile.phone || ''));
    setNewPhone(profile.phone || '');
  };

  const handleEmailUpdate = async () => {
    const currentUser = authInstance.currentUser;

    if (!currentUser?.email) {
      Alert.alert('Erro', 'Usuário não está logado');
      return;
    }
    if (!userRef) {
      Alert.alert('Erro', 'Referência do usuário inválida');
      return;
    }

    const nextEmail = normalizeEmail(newEmail);

    if (!nextEmail.includes('@') || !nextEmail.includes('.')) {
      Alert.alert('Erro', 'Email inválido');
      return;
    }

    if (normalizeEmail(currentUser.email) === nextEmail) {
      Alert.alert('Atenção', 'O novo e-mail é igual ao atual.');
      return;
    }

    if (!password) {
      Alert.alert('Erro', 'Digite sua senha para confirmar');
      return;
    }

    setUpdatingEmail(true);
    try {
      const methods = await authInstance.fetchSignInMethodsForEmail(nextEmail);
      if (methods.length > 0) {
        Alert.alert('Erro', 'Este e-mail já está em uso por outro usuário.');
        return;
      }

      const credential = auth.EmailAuthProvider.credential(currentUser.email, password);
      await currentUser.reauthenticateWithCredential(credential);

      await currentUser.verifyBeforeUpdateEmail(nextEmail);

      await updateDoc(userRef, {
        pendingEmail: nextEmail,
      });

      Alert.alert(
        'Link enviado',
        'Verifique seu novo email e clique no link de confirmação. Após confirmar, você precisará fazer login novamente.',
        [
          {
            text: 'Entendi',
            onPress: () => {
              setEditingEmail(false);
              setNewEmail('');
              setPassword('');
            },
          },
        ],
      );
    } catch (error: any) {
      const code = error?.code;

      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        Alert.alert('Erro', 'Senha incorreta');
      } else if (code === 'auth/too-many-requests') {
        Alert.alert('Erro', 'Muitas tentativas. Aguarde alguns minutos.');
      } else if (code === 'auth/requires-recent-login') {
        Alert.alert('Erro', 'Faça login novamente para alterar seu e-mail.');
      } else if (code === 'auth/email-already-in-use') {
        Alert.alert('Erro', 'Email já em uso por outro usuário.');
      } else if (code === 'auth/invalid-email') {
        Alert.alert('Erro', 'Email inválido.');
      } else {
        Alert.alert('Erro', `Não foi possível alterar.\n${error?.message || ''}`.trim());
      }
    } finally {
      setUpdatingEmail(false);
    }
  };

  const checkEmailConfirmed = async () => {
    const currentUser = authInstance.currentUser;
    if (!currentUser?.email || !userRef) return;

    setCheckingConfirm(true);
    try {
      await currentUser.reload();
      const updatedEmail = currentUser.email;

      const pending = normalizeEmail(profile.pendingEmail || '');
      const authEmail = normalizeEmail(updatedEmail || '');

      if (!pending) {
        Alert.alert('Info', 'Não há e-mail pendente para confirmar.');
        return;
      }

      if (authEmail === pending) {
        await updateDoc(userRef, {
          email: updatedEmail,
          pendingEmail: deleteField(),
        });

        setProfile(prev => ({
          ...prev,
          email: updatedEmail || '',
          pendingEmail: '',
        }));

        Alert.alert(
          'Email confirmado',
          'Seu email foi atualizado com sucesso. Faça login novamente para continuar.',
          [
            {
              text: 'OK',
              onPress: () => {
                authInstance.signOut();
              },
            },
          ],
        );
      } else {
        Alert.alert(
          'Ainda não confirmado',
          'Clique no link que enviamos para seu novo email e tente novamente.',
        );
      }
    } catch (error: any) {
      if (error.code === 'auth/user-token-expired') {
        Alert.alert(
          'Sessão expirada',
          'Seu email foi alterado com sucesso. Faça login novamente.',
          [
            {
              text: 'OK',
              onPress: () => {
                authInstance.signOut();
              },
            },
          ],
        );
      } else {
        Alert.alert('Erro', 'Não foi possível verificar a confirmação agora.');
      }
    } finally {
      setCheckingConfirm(false);
    }
  };

  const cancelEmailEdit = () => {
    setEditingEmail(false);
    setNewEmail('');
    setPassword('');
  };

  const cancelNameEdit = () => {
    setEditingName(false);
  };

  const handlePasswordReset = () => {
    const email = profile.email || user?.email;
    if (!email) {
      Alert.alert('Erro', 'Não encontramos um e-mail para enviar a troca de senha.');
      return;
    }

    Alert.alert('Trocar senha', `Enviar link de redefinição para ${email}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Enviar',
        onPress: async () => {
          try {
            await authInstance.sendPasswordResetEmail(email);
            Alert.alert('Enviado', 'Confira sua caixa de entrada para redefinir a senha.');
          } catch {
            Alert.alert('Erro', 'Não foi possível enviar o link agora.');
          }
        },
      },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Sair da conta', 'Deseja encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={D.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={D.bg} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.squareButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.75}
            >
              <ArrowLeft size={22} color={D.ink} />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Perfil</Text>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <View style={styles.avatar}>
                {avatarSource ? (
                  <Image source={avatarSource} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{initials}</Text>
                )}
              </View>

              <View style={styles.heroInfo}>
                <View style={styles.heroTopLine}>
                  <View style={styles.heroTextBlock}>
                    <Text style={styles.name} numberOfLines={1}>
                      {displayName}
                    </Text>
                  </View>
                  <View style={styles.rolePill}>
                    <Text style={styles.rolePillText}>Cliente</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Dados pessoais</Text>
            </View>

            <View style={styles.card}>
              {!editingName ? (
                <DataRow label="Nome" value={displayName} onPress={() => setEditingName(true)} />
              ) : (
                <View style={[styles.editBlock, styles.rowBorder]}>
                  <ProfileTextInput
                    label="Nome"
                    value={profile.firstName || ''}
                    onChangeText={text => setProfile({ ...profile, firstName: text })}
                    placeholder="Seu nome"
                    editable={!saving}
                    floating
                  />
                  <ProfileTextInput
                    label="Sobrenome"
                    value={profile.lastName || ''}
                    onChangeText={text => setProfile({ ...profile, lastName: text })}
                    placeholder="Seu sobrenome"
                    editable={!saving}
                    floating
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={cancelNameEdit}
                      disabled={saving}
                    >
                      <X size={16} color={D.ink} />
                      <Text style={styles.actionText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.confirmButton]}
                      onPress={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color={D.onPrimary} />
                      ) : (
                        <>
                          <Check size={16} color={D.onPrimary} />
                          <Text style={styles.confirmText}>Salvar</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {!editingEmail ? (
                <DataRow
                  label="E-mail"
                  value={profile.email || 'Não informado'}
                  onPress={() => setEditingEmail(true)}
                  bordered
                />
              ) : (
                <View style={styles.editBlock}>
                  <ProfileTextInput
                    label="Novo e-mail"
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder="novo@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!updatingEmail}
                    floating
                  />
                  <ProfileTextInput
                    label="Senha atual"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Digite sua senha"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!updatingEmail}
                    floating
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={cancelEmailEdit}
                      disabled={updatingEmail}
                    >
                      <X size={16} color={D.ink} />
                      <Text style={styles.actionText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.confirmButton]}
                      onPress={handleEmailUpdate}
                      disabled={updatingEmail}
                    >
                      {updatingEmail ? (
                        <ActivityIndicator size="small" color={D.onPrimary} />
                      ) : (
                        <>
                          <Check size={16} color={D.onPrimary} />
                          <Text style={styles.confirmText}>Confirmar</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {!!profile.pendingEmail && (
                <View style={styles.pendingBox}>
                  <View style={styles.pendingTextWrap}>
                    <Text style={styles.pendingTitle}>Confirmação pendente</Text>
                    <Text style={styles.pendingEmail} numberOfLines={1}>
                      {profile.pendingEmail}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.verifyButton, checkingConfirm && styles.disabled]}
                    onPress={checkEmailConfirmed}
                    disabled={checkingConfirm}
                    activeOpacity={0.75}
                  >
                    {checkingConfirm ? (
                      <ActivityIndicator size="small" color={D.onPrimary} />
                    ) : (
                      <RefreshCw size={16} color={D.onPrimary} />
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {!editingPhone ? (
                <DataRow
                  label="Telefone"
                  value={profile.phone ? formatUtils.phoneMask(profile.phone) : 'Não informado'}
                  onPress={() => setEditingPhone(true)}
                  bordered
                />
              ) : (
                <View style={[styles.editBlock, styles.rowBorder]}>
                  <ProfileTextInput
                    label="Telefone"
                    value={displayPhone}
                    onChangeText={handlePhoneChange}
                    placeholder="(11) 91234-5678"
                    keyboardType="phone-pad"
                    maxLength={15}
                    editable={!saving}
                    floating
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={cancelPhoneEdit}
                      disabled={saving}
                    >
                      <X size={16} color={D.ink} />
                      <Text style={styles.actionText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.confirmButton]}
                      onPress={handlePhoneSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color={D.onPrimary} />
                      ) : (
                        <>
                          <Check size={16} color={D.onPrimary} />
                          <Text style={styles.confirmText}>Salvar</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <DataRow label="Estética vinculada" value={linkedShopName} bordered last />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Conta</Text>
            </View>

            <View style={styles.card}>
              <SettingsRow label="Trocar senha" onPress={handlePasswordReset} />
              <SettingsRow
                label="Notificações"
                onPress={() => Alert.alert('Notificações', 'Preferências em breve.')}
              />
              <SettingsRow
                label="Suporte"
                onPress={() => Alert.alert('Suporte', 'Fale com a equipe DetailGo pelo suporte.')}
              />
              <ThemeSettingsRow isLight={isLight} onToggle={toggleTheme} />
              <SettingsRow label="Sair" onPress={handleSignOut} danger last />
            </View>

            <View style={styles.footerSpace} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

function ProfileTextInput({
  label,
  last,
  floating,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  last?: boolean;
  floating?: boolean;
}) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);

  return (
    <View
      style={[
        styles.inputRow,
        !last && !floating && styles.rowBorder,
        floating && styles.floatingInput,
      ]}
    >
      <View style={styles.inputTextWrap}>
        <Text style={styles.dataLabel}>{label}</Text>
        <TextInput
          style={styles.textInput}
          placeholderTextColor={D.ink3}
          selectionColor={D.primary}
          {...props}
        />
      </View>
    </View>
  );
}

function DataRow({
  label,
  value,
  onPress,
  bordered,
  last,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  bordered?: boolean;
  last?: boolean;
}) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);

  return (
    <TouchableOpacity
      style={[styles.summaryRow, bordered && styles.rowBorder, last && styles.lastSummaryRow]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </TouchableOpacity>
  );
}

function SettingsRow({
  label,
  onPress,
  danger,
  last,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);

  return (
    <TouchableOpacity
      style={[styles.settingsRow, !last && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.settingsLabel, danger && styles.dangerText]}>{label}</Text>
      <ChevronRight size={18} color={D.ink3} />
    </TouchableOpacity>
  );
}

function ThemeSettingsRow({ isLight, onToggle }: { isLight: boolean; onToggle: () => void }) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);

  return (
    <TouchableOpacity style={[styles.themeRow, styles.rowBorder]} onPress={onToggle}>
      <Text style={styles.settingsLabel}>{isLight ? 'Tema claro' : 'Tema escuro'}</Text>
      <View style={[styles.themeToggle, isLight && styles.themeToggleActive]}>
        <View style={[styles.themeToggleThumb, isLight && styles.themeToggleThumbActive]}>
          {isLight ? (
            <Sun size={15} color={D.onPrimary} strokeWidth={2.4} />
          ) : (
            <Moon size={15} color={D.primary} strokeWidth={2.4} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function createStyles(D: AppColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: D.bg,
    },
    container: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    header: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: D.border,
    },
    squareButton: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: D.surface,
      borderWidth: 1.5,
      borderColor: D.borderStrong,
    },
    squareButtonGhost: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: D.primaryLight,
      borderWidth: 1,
      borderColor: D.borderFocus,
    },
    headerTextWrap: {
      flex: 1,
    },
    headerKicker: {
      color: D.primary,
      fontFamily: T.family.medium,
      fontSize: T.size.caption,
      lineHeight: T.lineHeight.caption,
      fontWeight: '700',
      letterSpacing: 1.2,
    },
    headerTitle: {
      color: D.ink,
      fontFamily: T.family.medium,
      fontSize: T.size.title,
      lineHeight: T.lineHeight.title,
      fontWeight: '800',
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
    },
    hero: {
      minHeight: 74,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 4,
    },
    heroGlow: {
      position: 'absolute',
      width: 170,
      height: 110,
      right: -54,
      top: -34,
      borderRadius: 85,
      backgroundColor: D.primaryLight,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: D.primary,
    },
    avatarImage: {
      width: 64,
      height: 64,
      borderRadius: 32,
    },
    avatarText: {
      color: D.onPrimary,
      fontFamily: T.family.medium,
      fontSize: T.size.titleLarge,
      fontWeight: '800',
    },
    heroInfo: {
      flex: 1,
      minWidth: 0,
    },
    heroTopLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    heroTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      color: D.ink,
      fontFamily: T.family.medium,
      fontSize: T.size.title,
      lineHeight: T.lineHeight.title,
      fontWeight: '800',
    },
    email: {
      color: D.ink2,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      marginTop: 2,
      fontWeight: '500',
    },
    rolePill: {
      alignSelf: 'center',
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: D.primaryLight,
      borderWidth: 1,
      borderColor: D.borderFocus,
    },
    rolePillText: {
      color: D.primary,
      fontFamily: T.family.medium,
      fontSize: T.size.caption,
      fontWeight: '700',
    },

    sectionHeader: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingBottom: 10,
    },
    sectionLabel: {
      color: D.ink2,
      fontFamily: T.family.medium,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      fontWeight: '700',
    },
    card: {
      borderRadius: 14,
      backgroundColor: D.card,
      borderWidth: 1.5,
      borderColor: D.borderStrong,
      overflow: 'hidden',
    },
    rowBorder: {
      borderTopWidth: 1,
      borderTopColor: D.border,
    },
    summaryRow: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 16,
    },
    lastSummaryRow: {
      minHeight: 45,
    },
    summaryLabel: {
      width: 112,
      color: D.ink2,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      fontWeight: '500',
    },
    summaryValue: {
      flex: 1,
      color: D.ink,
      fontFamily: T.family.medium,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      fontWeight: '600',
      textAlign: 'right',
    },

    inputRow: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    floatingInput: {
      minHeight: 64,
      borderRadius: 14,
      backgroundColor: D.surface,
      borderWidth: 1,
      borderColor: D.borderStrong,
      marginBottom: 10,
    },
    inputTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    textInput: {
      minHeight: 31,
      color: D.ink,
      fontFamily: T.family.medium,
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      fontWeight: '600',
      padding: 0,
    },
    dataRow: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    dataTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    dataLabel: {
      color: D.ink2,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      fontWeight: '500',
    },
    dataValue: {
      color: D.ink,
      fontFamily: T.family.medium,
      fontSize: T.size.body,
      lineHeight: T.lineHeight.body,
      fontWeight: '600',
      marginTop: 3,
    },
    editBlock: {
      padding: 14,
    },
    editActions: {
      flexDirection: 'row',
      gap: 10,
    },
    actionButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    cancelButton: {
      backgroundColor: D.surface,
      borderWidth: 1,
      borderColor: D.borderStrong,
    },
    confirmButton: {
      backgroundColor: D.primary,
    },
    actionText: {
      color: D.ink,
      fontFamily: T.family.medium,
      fontSize: T.size.secondary,
      fontWeight: '600',
    },
    confirmText: {
      color: D.onPrimary,
      fontFamily: T.family.medium,
      fontSize: T.size.secondary,
      fontWeight: '700',
    },

    pendingBox: {
      marginHorizontal: 14,
      marginBottom: 14,
      padding: 12,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: D.primaryLight,
      borderWidth: 1,
      borderColor: D.borderFocus,
    },
    pendingTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    pendingTitle: {
      color: D.primary,
      fontFamily: T.family.medium,
      fontSize: T.size.secondary,
      fontWeight: '700',
    },
    pendingEmail: {
      color: D.ink,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      marginTop: 2,
      fontWeight: '500',
    },
    verifyButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: D.primary,
    },

    settingsRow: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
    },
    settingsLabel: {
      flex: 1,
      color: D.ink2,
      fontFamily: T.family.regular,
      fontSize: T.size.secondary,
      lineHeight: T.lineHeight.secondary,
      fontWeight: '500',
    },
    themeRow: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
    },
    themeToggle: {
      width: 56,
      height: 32,
      borderRadius: 16,
      padding: 3,
      justifyContent: 'center',
      backgroundColor: D.surface,
      borderWidth: 1,
      borderColor: D.borderStrong,
    },
    themeToggleActive: {
      backgroundColor: D.primaryLight,
      borderColor: D.borderFocus,
    },
    themeToggleThumb: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: D.card,
      borderWidth: 1,
      borderColor: D.borderStrong,
    },
    themeToggleThumbActive: {
      alignSelf: 'flex-end',
      backgroundColor: D.primary,
      borderColor: D.primary,
    },
    dangerText: {
      color: D.accent,
    },

    saveMiniButton: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 13,
      borderRadius: 12,
      backgroundColor: D.primary,
    },
    saveMiniText: {
      color: D.onPrimary,
      fontFamily: T.family.medium,
      fontSize: T.size.secondary,
      fontWeight: '700',
    },
    disabled: {
      opacity: 0.6,
    },
    footerSpace: {
      height: 38,
    },
  });
}
