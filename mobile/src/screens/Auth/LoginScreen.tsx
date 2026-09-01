import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { useTheme } from '../../hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';

const APPLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_APPLE_CLIENT_ID ||
  (Constants.expoConfig?.extra as { appleClientId?: string } | undefined)?.appleClientId ||
  '';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const gutter = width < 360 ? 12 : width >= 768 ? 28 : 16;
  const formMax = Math.min(Math.max(width - gutter * 2, 280), 440);
  const { login, loginWithGoogle, loginWithApple, complete2FA, pending2FA, clearPending2FA } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string; otp?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!identifier.trim()) e.identifier = t('mobile.usernameOrEmail');
    if (!password) e.password = t('mobile.passwordRequired');
    else if (password.length < 6) e.password = t('auth.passwordMin');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await login(identifier.trim(), password);
      if (result.requires_2fa) {
        Alert.alert(t('mobile.twoFactorTitle'), t('mobile.twoFactorBody'));
      }
    } catch (err: any) {
      const data = err?.response?.data || {};
      const msg =
        data.detail ||
        data.error ||
        (data.code === 'email_not_verified'
          ? t('mobile.verifyEmailFirst')
          : t('auth.loginFailed'));
      Alert.alert(t('auth.signIn'), msg);
    } finally {
      setLoading(false);
    }
  };

  const handle2FA = async () => {
    if (!otp.trim()) {
      setErrors({ otp: t('mobile.authenticatorCode') });
      return;
    }
    setLoading(true);
    try {
      await complete2FA(otp.trim());
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Invalid code';
      Alert.alert(t('auth.signIn'), msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await loginWithGoogle();
      if (result.requires_2fa) {
        Alert.alert(t('mobile.twoFactorTitle'), t('mobile.twoFactorBody'));
      }
    } catch (err: any) {
      Alert.alert(t('auth.signIn'), err?.message || t('auth.googleFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setLoading(true);
    try {
      const result = await loginWithApple();
      if (result.requires_2fa) {
        Alert.alert(t('mobile.twoFactorTitle'), t('mobile.twoFactorBody'));
      }
    } catch (err: any) {
      Alert.alert(t('auth.signIn'), err?.message || t('auth.appleFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!identifier.trim() || !identifier.includes('@')) {
      Alert.alert(t('auth.resetPasswordTitle'), t('auth.enterEmail'));
      return;
    }
    setLoading(true);
    try {
      await api.forgotPassword(identifier.trim());
      Alert.alert(t('mobile.checkEmail'), t('auth.resetLinkExpiryNotice'));
      setForgotMode(false);
    } catch (err: any) {
      Alert.alert(t('auth.resetPasswordTitle'), err?.response?.data?.error || t('auth.resetEmailFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: '100%', maxWidth: formMax, alignSelf: 'center' }}>
          <View style={styles.header}>
            <Text style={[styles.logoText, { color: colors.text }]}>Cosonova</Text>
            <Text style={[styles.title, { color: colors.text }]}>{t('auth.welcomeBack')}</Text>
            <Text style={[styles.tagline, { color: colors.textSecondary }]}>{t('auth.signInSubtitle')}</Text>
          </View>

          <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {pending2FA ? (
              <>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('mobile.twoFactorBody')}</Text>
                <Input
                  label={t('mobile.authenticatorCode')}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="123456"
                  keyboardType="numeric"
                  error={errors.otp}
                />
                <Button
                  label={t('auth.confirm')}
                  onPress={handle2FA}
                  loading={loading}
                  size="lg"
                  fullWidth
                  style={styles.submitBtn}
                />
                <Button
                  label={t('common.back')}
                  onPress={clearPending2FA}
                  variant="ghost"
                  size="sm"
                />
              </>
            ) : forgotMode ? (
              <>
                <Input
                  label={t('auth.email')}
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="you@email.com"
                  keyboardType="email-address"
                  error={errors.identifier}
                />
                <Button
                  label={t('auth.sendResetLink')}
                  onPress={handleForgot}
                  loading={loading}
                  size="lg"
                  fullWidth
                  style={styles.submitBtn}
                />
                <Button
                  label={t('auth.backToSignIn')}
                  onPress={() => setForgotMode(false)}
                  variant="ghost"
                  size="sm"
                />
              </>
            ) : (
              <>
                <Input
                  label={t('auth.username')}
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder={t('auth.enterEmail')}
                  autoCapitalize="none"
                  error={errors.identifier}
                />
                <Input
                  label={t('auth.password')}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.enterPassword')}
                  secureTextEntry
                  error={errors.password}
                />
                <Button
                  label={t('auth.signIn')}
                  onPress={handleSubmit}
                  loading={loading}
                  size="lg"
                  fullWidth
                  style={styles.submitBtn}
                />
                <Button
                  label={t('mobile.continueWithGoogle')}
                  onPress={handleGoogle}
                  loading={loading}
                  variant="ghost"
                  size="lg"
                  fullWidth
                  style={[styles.googleBtn, { borderColor: colors.primary }]}
                />
                {APPLE_CLIENT_ID ? (
                  <Button
                    label={t('auth.continueWithApple')}
                    onPress={handleApple}
                    loading={loading}
                    variant="ghost"
                    size="lg"
                    fullWidth
                    style={[styles.googleBtn, { borderColor: colors.primary }]}
                  />
                ) : null}
                <Button
                  label={t('auth.forgotPassword')}
                  onPress={() => setForgotMode(true)}
                  variant="ghost"
                  size="sm"
                  style={styles.forgotBtn}
                />
              </>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>{t('auth.newToCosonova')}</Text>
            <Button
              label={t('auth.createAccount')}
              onPress={() => navigation.navigate('Register')}
              variant="ghost"
              size="sm"
            />
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 28 },
  logoText: { fontSize: 18, fontWeight: '800', letterSpacing: 0.4 },
  title: { fontSize: 28, fontWeight: '800', marginTop: 10 },
  tagline: { marginTop: 8, fontSize: 15 },
  form: { gap: 8, borderRadius: 28, borderWidth: 1, padding: 18 },
  hint: { marginBottom: 8, textAlign: 'center' },
  submitBtn: { marginTop: 12 },
  googleBtn: { marginTop: 8, borderWidth: 1 },
  forgotBtn: { marginTop: 4 },
  footer: { marginTop: 28, alignItems: 'center' },
  footerText: { marginBottom: 4 },
});
