import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import Button from '../../components/Button';
import Input from '../../components/Input';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { login, loginWithGoogle, loginWithApple, complete2FA, pending2FA, clearPending2FA } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string; otp?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!identifier.trim()) e.identifier = 'اسم المستخدم أو البريد مطلوب';
    if (!password) e.password = 'كلمة المرور مطلوبة';
    else if (password.length < 6) e.password = 'كلمة المرور قصيرة جداً';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await login(identifier.trim(), password);
      if (result.requires_2fa) {
        Alert.alert('التحقق بخطوتين', 'أدخل رمز المصادقة من تطبيقك.');
      }
    } catch (err: any) {
      const data = err?.response?.data || {};
      const msg =
        data.detail ||
        data.error ||
        (data.code === 'email_not_verified'
          ? 'يرجى تأكيد البريد الإلكتروني قبل تسجيل الدخول.'
          : 'فشل تسجيل الدخول');
      Alert.alert('خطأ', msg);
    } finally {
      setLoading(false);
    }
  };

  const handle2FA = async () => {
    if (!otp.trim()) {
      setErrors({ otp: 'أدخل رمز التحقق' });
      return;
    }
    setLoading(true);
    try {
      await complete2FA(otp.trim());
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'رمز غير صحيح';
      Alert.alert('خطأ', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await loginWithGoogle();
      if (result.requires_2fa) {
        Alert.alert('التحقق بخطوتين', 'أدخل رمز المصادقة من تطبيقك.');
      }
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'فشل تسجيل الدخول عبر Google');
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setLoading(true);
    try {
      const result = await loginWithApple();
      if (result.requires_2fa) {
        Alert.alert('التحقق بخطوتين', 'أدخل رمز المصادقة من تطبيقك.');
      }
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'فشل تسجيل الدخول عبر Apple');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!identifier.trim() || !identifier.includes('@')) {
      Alert.alert('تنبيه', 'أدخل بريدك الإلكتروني أولاً.');
      return;
    }
    setLoading(true);
    try {
      await api.forgotPassword(identifier.trim());
      Alert.alert('تم', 'إذا كان البريد مسجلاً، ستصلك رسالة إعادة تعيين.');
      setForgotMode(false);
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.error || 'تعذر إرسال الرسالة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.logoText}>Cosonova</Text>
            <Text style={styles.tagline}>انضم إلى مجتمع الإبداع</Text>
          </View>

          <View style={styles.form}>
            {pending2FA ? (
              <>
                <Text style={styles.hint}>أدخل رمز التحقق الثنائي</Text>
                <Input
                  label="رمز 2FA"
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="123456"
                  keyboardType="numeric"
                  error={errors.otp}
                />
                <Button
                  label="تأكيد"
                  onPress={handle2FA}
                  loading={loading}
                  size="lg"
                  fullWidth
                  style={styles.submitBtn}
                />
                <Button
                  label="رجوع"
                  onPress={clearPending2FA}
                  variant="ghost"
                  size="sm"
                />
              </>
            ) : forgotMode ? (
              <>
                <Input
                  label="البريد الإلكتروني"
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="example@email.com"
                  keyboardType="email-address"
                  error={errors.identifier}
                />
                <Button
                  label="إرسال رابط الاستعادة"
                  onPress={handleForgot}
                  loading={loading}
                  size="lg"
                  fullWidth
                  style={styles.submitBtn}
                />
                <Button
                  label="رجوع لتسجيل الدخول"
                  onPress={() => setForgotMode(false)}
                  variant="ghost"
                  size="sm"
                />
              </>
            ) : (
              <>
                <Input
                  label="اسم المستخدم أو البريد"
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="username أو email"
                  autoCapitalize="none"
                  error={errors.identifier}
                />
                <Input
                  label="كلمة المرور"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="•••••••"
                  secureTextEntry
                  error={errors.password}
                />
                <Button
                  label="تسجيل الدخول"
                  onPress={handleSubmit}
                  loading={loading}
                  size="lg"
                  fullWidth
                  style={styles.submitBtn}
                />
                <Button
                  label="المتابعة مع Google"
                  onPress={handleGoogle}
                  loading={loading}
                  variant="ghost"
                  size="lg"
                  fullWidth
                  style={styles.googleBtn}
                />
                <Button
                  label="المتابعة مع Apple"
                  onPress={handleApple}
                  loading={loading}
                  variant="ghost"
                  size="lg"
                  fullWidth
                  style={styles.googleBtn}
                />
                <Button
                  label="نسيت كلمة المرور؟"
                  onPress={() => setForgotMode(true)}
                  variant="ghost"
                  size="sm"
                  style={styles.forgotBtn}
                />
              </>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>ليس لديك حساب؟</Text>
            <Button
              label="إنشاء حساب"
              onPress={() => navigation.navigate('Register')}
              variant="ghost"
              size="sm"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f0a1f' },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  logoText: { fontSize: 36, fontWeight: '800', color: '#c4b5fd' },
  tagline: { marginTop: 8, color: '#a78bfa', fontSize: 15 },
  form: { gap: 8 },
  hint: { color: '#ddd6fe', marginBottom: 8, textAlign: 'center' },
  submitBtn: { marginTop: 12 },
  googleBtn: { marginTop: 8, borderWidth: 1, borderColor: '#7c3aed' },
  forgotBtn: { marginTop: 4 },
  footer: { marginTop: 28, alignItems: 'center' },
  footerText: { color: '#9ca3af', marginBottom: 4 },
});
