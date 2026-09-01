import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';

/** Pulse creator defaults — mirrors web Settings. */
export default function PulseCreatorSettingsScreen() {
  const { colors } = useTheme();
  const { t } = useLocale();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowRemix, setAllowRemix] = useState(true);
  const [allowWeave, setAllowWeave] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const prefs = await api.getPreferences();
      setAllowRemix(prefs.default_allow_remix !== false);
      setAllowWeave(prefs.default_allow_weave !== false);
      setAllowDownload(Boolean(prefs.default_allow_download));
    } catch {
      /* keep defaults */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: {
    default_allow_remix?: boolean;
    default_allow_weave?: boolean;
    default_allow_download?: boolean;
  }) => {
    setSaving(true);
    try {
      await api.updatePreferences({
        default_allow_remix: patch.default_allow_remix ?? allowRemix,
        default_allow_weave: patch.default_allow_weave ?? allowWeave,
        default_allow_download: patch.default_allow_download ?? allowDownload,
      });
    } catch {
      Alert.alert(t('mobile.errorTitle'), t('mobile.couldNotSavePulse'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorldBackdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title={t('mobile.pulseCreator')}
          subtitle={t('mobile.pulseCreatorSub')}
          onBack={() => navigation.goBack()}
        />

      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t('mobile.pulseHint')}
      </Text>

      {loading ? (
        <ActivityIndicator color="#A78BFA" style={{ marginTop: 32 }} />
      ) : (
        <View style={{ padding: 16, gap: 4 }}>
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.text }]}>{t('mobile.allowRemix')}</Text>
            <Switch
              value={allowRemix}
              onValueChange={(v) => {
                setAllowRemix(v);
                void save({ default_allow_remix: v });
              }}
              disabled={saving}
              trackColor={{ true: '#7C3AED', false: colors.border }}
            />
          </View>
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.text }]}>{t('mobile.allowWeave')}</Text>
            <Switch
              value={allowWeave}
              onValueChange={(v) => {
                setAllowWeave(v);
                void save({ default_allow_weave: v });
              }}
              disabled={saving}
              trackColor={{ true: '#7C3AED', false: colors.border }}
            />
          </View>
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.text }]}>{t('mobile.allowExport')}</Text>
            <Switch
              value={allowDownload}
              onValueChange={(v) => {
                setAllowDownload(v);
                void save({ default_allow_download: v });
              }}
              disabled={saving}
              trackColor={{ true: '#7C3AED', false: colors.border }}
            />
          </View>
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
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '800' },
  hint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  label: { fontSize: 15, fontWeight: '700' },
});
