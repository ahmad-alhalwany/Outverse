import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';

const CATEGORY_KEYS: Record<string, string> = {
  historical: 'mobile.catHistorical',
  fantasy: 'mobile.catFantasy',
  scifi: 'mobile.catScifi',
  philosophical: 'mobile.catPhilosophical',
  mystery: 'mobile.catMystery',
  surreal: 'mobile.catSurreal',
  everyday: 'mobile.catEveryday',
  emotional: 'mobile.catEmotional',
};

export default function InspirationTasteScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [preferred, setPreferred] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getInspirationStats();
      setPreferred(Array.isArray(data.preferred_categories) ? data.preferred_categories : []);
      setInterests(Array.isArray(data.interests) ? data.interests.filter((item) => typeof item === 'string') : []);
    } catch {
      setPreferred([]);
      setInterests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!user?.id) return;
    const next = draft
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const merged = [...new Set([...interests.filter((item) => !item.startsWith('guide:') && !item.startsWith('mood:')), ...next])];
    setSaving(true);
    try {
      await api.updateProfile(user.id, { interests: merged });
      setInterests(merged);
      setDraft('');
      Alert.alert(t('mobile.tasteTitle'), t('mobile.tasteUpdated'));
      void load();
    } catch {
      Alert.alert(t('mobile.tasteTitle'), t('mobile.tasteSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorldBackdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title={t('mobile.tasteTitle')}
          subtitle={t('mobile.tasteHero')}
          onBack={() => navigation.goBack()}
        />
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.text }]}>{t('mobile.topCategories')}</Text>
              {preferred.length ? (
                <View style={styles.chips}>
                  {preferred.map((cat) => (
                    <View key={cat} style={[styles.chip, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={[styles.chipText, { color: colors.primary }]}>{CATEGORY_KEYS[cat] ? t(CATEGORY_KEYS[cat]) : cat}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('mobile.answerDailyToShape')}</Text>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.text }]}>{t('mobile.yourInterests')}</Text>
              {interests.length ? (
                <View style={styles.chips}>
                  {interests.map((item) => (
                    <View key={item} style={[styles.chip, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={[styles.chipText, { color: colors.text }]}>{item}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('mobile.noInterestsYet')}</Text>
              )}
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t('mobile.interestsPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
              />
              <Pressable
                onPress={() => void save()}
                disabled={saving || !draft.trim()}
                style={[styles.btn, { backgroundColor: colors.primary, opacity: saving || !draft.trim() ? 0.6 : 1 }]}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('common.save')}</Text>}
              </Pressable>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14 },
  label: { fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 13, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 12, fontWeight: '700' },
  input: { marginTop: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  btn: { marginTop: 12, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800' },
});
