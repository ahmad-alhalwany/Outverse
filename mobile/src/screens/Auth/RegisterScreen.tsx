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
import Button from '../../components/Button';
import Input from '../../components/Input';

export default function RegisterScreen() {
  const navigation = useNavigation<any>();
  const { register } = useAuth();
  const [form, setForm] = useState({ username: '', email: '', password: '', password_confirm: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (k: keyof typeof form) => (v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.username.trim()) e.username = 'اسم المستخدم مطلوب';
    else if (form.username.length < 3) e.username = 'اسم المستخدم قصير جداً';
    if (!form.email.trim()) e.email = 'البريد مطلوب';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'صيغة بريد غير صحيحة';
    if (!form.password) e.password = 'كلمة المرور مطلوبة';
    else if (form.password.length < 8) e.password = '8 أحرف على الأقل';
    if (form.password !== form.password_confirm) e.password_confirm = 'كلمتا المرور غير متطابقتين';
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
          'تحقق من بريدك',
          'تم إنشاء الحساب. أكّد بريدك الإلكتروني ثم سجّل الدخول.',
          [{ text: 'حسناً', onPress: () => navigation.navigate('Login') }],
        );
      }
    } catch (err: any) {
      const data = err?.response?.data;
      const msg = data?.detail || data?.error || Object.values(data || {})[0] || 'فشل التسجيل';
      Alert.alert('خطأ', typeof msg === 'string' ? msg : 'تحقق من البيانات');
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
            <Text style={styles.logoText}>Cosmory</Text>
            <Text style={styles.tagline}>أنشئ حسابك الجديد</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="اسم المستخدم"
              value={form.username}
              onChangeText={update('username')}
              placeholder="username"
              error={errors.username}
            />
            <Input
              label="البريد الإلكتروني"
              value={form.email}
              onChangeText={update('email')}
              placeholder="example@email.com"
              keyboardType="email-address"
              error={errors.email}
            />
            <Input
              label="كلمة المرور"
              value={form.password}
              onChangeText={update('password')}
              placeholder="8 أحرف على الأقل"
              secureTextEntry
              error={errors.password}
            />
            <Input
              label="تأكيد كلمة المرور"
              value={form.password_confirm}
              onChangeText={update('password_confirm')}
              placeholder="أعد إدخال كلمة المرور"
              secureTextEntry
              error={errors.password_confirm}
            />
            <Button
              label="إنشاء الحساب"
              onPress={handleSubmit}
              loading={loading}
              size="lg"
              fullWidth
              style={styles.submitBtn}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>لديك حساب؟ </Text>
            <Text
              style={styles.linkText}
              onPress={() => navigation.navigate('Login')}
            >
              تسجيل الدخول
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#6366f1',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#6b7280',
  },
  form: {
    marginBottom: 20,
  },
  submitBtn: {
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 15,
    color: '#6b7280',
  },
  linkText: {
    fontSize: 15,
    color: '#6366f1',
    fontWeight: '700',
  },
});
