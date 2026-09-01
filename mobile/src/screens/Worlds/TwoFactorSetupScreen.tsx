import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  WorldBackdrop,
  WorldCard,
  WorldHeader,
  WorldHero,
  WorldPrimaryButton,
  WorldStat,
} from '@/components/world/WorldChrome';

export default function TwoFactorSetupScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { t } = useLocale();
  const [status, setStatus] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await api.getTwoFactorStatus());
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enable = async () => {
    if (!password.trim()) return;
    setEnabling(true);
    try {
      setStatus(await api.enableTwoFactor(password));
      setPassword('');
    } catch (error: any) {
      Alert.alert(t('security.twoFactor'), error?.response?.data?.detail || t('mobile.couldNotEnable2FA'));
    } finally {
      setEnabling(false);
    }
  };

  return (
    <WorldBackdrop tone="vault">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader title={t('security.twoFactor')} subtitle={t('mobile.accountSecurity')} tone="vault" onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.content}>
          <WorldHero
            tone="vault"
            eyebrow={t('mobile.accountSecurity')}
            title={t('mobile.twoFactor')}
            body={t('security.twoFactorHint')}
          />
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <View style={styles.statsRow}>
                <WorldStat label={t('mobile.enabled')} value={status?.enabled || status?.is_enabled ? t('mobile.yes') : t('mobile.no')} />
                <WorldStat label={t('mobile.verified')} value={status?.verified ? t('mobile.yes') : t('mobile.no')} />
              </View>
              <WorldCard>
                <Text style={[styles.label, { color: colors.text }]}>{t('mobile.enableSetup')}</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('mobile.password')}
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                />
                <WorldPrimaryButton label={t('mobile.enable2FA')} onPress={enable} loading={enabling} disabled={enabling || !password.trim()} />
              </WorldCard>
              {status?.qr_code || status?.qr || status?.secret ? (
                <WorldCard>
                  <Text style={[styles.label, { color: colors.text }]}>Authenticator setup</Text>
                  {status?.secret ? (
                    <Text selectable style={[styles.secret, { color: colors.primary }]}>
                      {status.secret}
                    </Text>
                  ) : null}
                  {status?.qr_code || status?.qr ? (
                    <Text selectable style={[styles.qr, { color: colors.textSecondary }]}>
                      {status.qr_code || status.qr}
                    </Text>
                  ) : null}
                </WorldCard>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  label: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 16, marginBottom: 12 },
  secret: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  qr: { fontSize: 12, lineHeight: 18 },
});
