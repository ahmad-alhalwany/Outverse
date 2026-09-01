import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthContext';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { useTheme } from '../../hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';

export default function RegisterScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const gutter = width < 360 ? 12 : width >= 768 ? 28 : 16;
  const formMax = Math.min(Math.max(width - gutter * 2, 280), 440);
  const { register } = useAuth();
  const [form, setForm] = useState({ username: '', email: '', password: '', password_confirm: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (k: keyof typeof form) => (v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.username.trim()) e.username = t('mobile.usernameRequired');
    else if (form.username.length < 3) e.username = t('mobile.usernameShort');
    if (!form.email.trim()) e.email = t('mobile.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t('mobile.emailInvalid');
    if (!form.password) e.password = t('mobile.passwordRequired');
    else if (form.password.length < 8) e.password = t('mobile.passwordMin8');
    if (form.password !== form.password_confirm) e.password_confirm = t('auth.passwordsMismatch');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      if (result?.needs_verification) {
        Alert.alert(
          t('mobile.checkEmail'),
          t('auth.verificationNotice'),
          [{ text: t('common.continue'), onPress: () => navigation.navigate('Login') }],
        );
      }
    } catch (err: any) {
      const data = err?.response?.data;
      const msg = data?.detail || data?.error || Object.values(data || {})[0] || t('auth.registrationFailed');
      Alert.alert(t('auth.signUp'), typeof msg === 'string' ? msg : t('auth.registrationFailed'));
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
            <Text style={[styles.title, { color: colors.text }]}>{t('auth.joinCosonova')}</Text>
            <Text style={[styles.tagline, { color: colors.textSecondary }]}>
              {t('auth.registerSubtitle')}
            </Text>
          </View>

          <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Input
              label={t('auth.username')}
              value={form.username}
              onChangeText={update('username')}
              placeholder="username"
              error={errors.username}
            />
            <Input
              label={t('auth.email')}
              value={form.email}
              onChangeText={update('email')}
              placeholder="you@email.com"
              keyboardType="email-address"
              error={errors.email}
            />
            <Input
              label={t('auth.password')}
              value={form.password}
              onChangeText={update('password')}
              placeholder={t('mobile.passwordMinPlaceholder')}
              secureTextEntry
              error={errors.password}
            />
            <Input
              label={t('auth.confirm')}
              value={form.password_confirm}
              onChangeText={update('password_confirm')}
              placeholder={t('auth.confirmPassword')}
              secureTextEntry
              error={errors.password_confirm}
            />
            <Button
              label={t('auth.createAccount')}
              onPress={handleSubmit}
              loading={loading}
              size="lg"
              fullWidth
              style={styles.submitBtn}
            />
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>{t('auth.alreadyHaveAccount')}</Text>
            <Pressable
              onPress={() => navigation.navigate('Login')}
              accessibilityRole="button"
              accessibilityLabel={t('auth.signIn')}
              style={styles.footerLink}
            >
              <Text style={[styles.linkText, { color: colors.primary }]}>{t('auth.signIn')}</Text>
            </Pressable>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 40 },
  header: { alignItems: 'center', marginBottom: 28 },
  logoText: { fontSize: 18, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800', marginTop: 10 },
  tagline: { fontSize: 15, marginTop: 8, textAlign: 'center' },
  form: { marginBottom: 20, borderRadius: 28, borderWidth: 1, padding: 18, gap: 4 },
  submitBtn: { marginTop: 8 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  footerLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  footerText: { fontSize: 15 },
  linkText: { fontSize: 15, fontWeight: '700' },
});
