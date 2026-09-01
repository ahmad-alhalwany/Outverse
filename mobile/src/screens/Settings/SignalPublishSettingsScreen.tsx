import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';

/** Signal publish defaults — Who can echo back on new posts. */
export default function SignalPublishSettingsScreen() {
  const { colors } = useTheme();
  const { t } = useLocale();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [replyControl, setReplyControl] = useState<'everyone' | 'followers' | 'nobody'>('everyone');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const prefs = await api.getPreferences();
      const rc = prefs.default_reply_control;
      if (rc === 'everyone' || rc === 'followers' || rc === 'nobody') setReplyControl(rc);
    } catch {
      /* defaults */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (next: 'everyone' | 'followers' | 'nobody') => {
    setReplyControl(next);
    setSaving(true);
    try {
      await api.updatePreferences({ default_reply_control: next });
    } catch {
      Alert.alert(t('mobile.errorTitle'), t('mobile.couldNotSavePublish'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorldBackdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title={t('mobile.signalPublish')}
          subtitle={t('mobile.signalPublishSub')}
          onBack={() => navigation.goBack()}
        />

      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t('mobile.signalPublishHint')}
      </Text>

      {loading ? (
        <ActivityIndicator color="#A78BFA" style={{ marginTop: 32 }} />
      ) : (
        <View style={{ padding: 16, gap: 8 }}>
          {(
            [
              { id: 'everyone' as const, label: t('social.policyEveryone') },
              { id: 'followers' as const, label: t('social.policyFollowers') },
              { id: 'nobody' as const, label: t('social.policyNone') },
            ]
          ).map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => void save(opt.id)}
              disabled={saving}
              style={[
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: replyControl === opt.id ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>{opt.label}</Text>
              {replyControl === opt.id ? (
                <Text style={{ color: colors.primary, fontWeight: '800' }}>✓</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '800' },
  hint: { paddingHorizontal: 16, paddingTop: 12, fontSize: 13, lineHeight: 18 },
  row: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
