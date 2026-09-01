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
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';

type Policy = 'everyone' | 'followers' | 'following' | 'none';
type ProfileVisibility = 'public' | 'followers' | 'private';
type BottlePrivacy = 'map_only' | 'catch_only' | 'private';

type PrivacyState = {
  dm_policy: Policy;
  comment_policy: Policy;
  mention_policy: Policy;
  tag_policy: Policy;
  hidden_words: string[];
  profile_visibility: ProfileVisibility;
  bottle_privacy: BottlePrivacy;
};

const POLICY_OPTION_KEYS: Array<{ id: Policy; labelKey: string }> = [
  { id: 'everyone', labelKey: 'social.policyEveryone' },
  { id: 'followers', labelKey: 'social.policyFollowers' },
  { id: 'following', labelKey: 'social.policyFollowing' },
  { id: 'none', labelKey: 'social.policyNone' },
];

function ChoiceChips({
  value,
  options,
  onChange,
  colors,
}: {
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
  colors: { text: string; primary: string; surfaceSecondary: string };
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surfaceSecondary }]}
          >
            <Text style={[styles.chipText, { color: active ? '#fff' : colors.text }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function PrivacyScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wordsInput, setWordsInput] = useState('');
  const [prefs, setPrefs] = useState<PrivacyState>({
    dm_policy: 'everyone',
    comment_policy: 'everyone',
    mention_policy: 'everyone',
    tag_policy: 'everyone',
    hidden_words: [],
    profile_visibility: 'public',
    bottle_privacy: 'map_only',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPreferences();
      const next: PrivacyState = {
        dm_policy: data.dm_policy || 'everyone',
        comment_policy: data.comment_policy || 'everyone',
        mention_policy: data.mention_policy || 'everyone',
        tag_policy: data.tag_policy || 'everyone',
        hidden_words: Array.isArray(data.hidden_words) ? data.hidden_words : [],
        profile_visibility: data.profile_visibility || 'public',
        bottle_privacy: data.bottle_privacy || 'map_only',
      };
      setPrefs(next);
      setWordsInput(next.hidden_words.join(', '));
    } catch {
      /* keep defaults */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: Partial<PrivacyState>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    try {
      await api.updatePreferences(next);
    } catch {
      Alert.alert(t('social.privacyTitle'), t('social.prefsError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorldBackdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title={t('social.privacyTitle')}
          subtitle={t('mobile.privacyReach')}
          onBack={() => navigation.goBack()}
        />
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {(
              [
                ['dm_policy', 'social.dmPolicy'],
                ['comment_policy', 'social.commentPolicy'],
                ['mention_policy', 'social.mentionPolicy'],
                ['tag_policy', 'social.tagPolicy'],
              ] as const
            ).map(([key, labelKey]) => (
              <View key={key} style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.text }]}>{t(labelKey)}</Text>
                <ChoiceChips
                  value={prefs[key]}
                  options={POLICY_OPTION_KEYS.map((opt) => ({ id: opt.id, label: t(opt.labelKey) }))}
                  onChange={(id) => void save({ [key]: id as Policy })}
                  colors={colors}
                />
              </View>
            ))}

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.text }]}>{t('mobile.profileVisibility')}</Text>
              <ChoiceChips
                value={prefs.profile_visibility}
                options={[
                  { id: 'public', label: t('mobile.visibilityPublic') },
                  { id: 'followers', label: t('mobile.visibilityFollowers') },
                  { id: 'private', label: t('mobile.visibilityPrivate') },
                ]}
                onChange={(id) => void save({ profile_visibility: id as ProfileVisibility })}
                colors={colors}
              />
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.text }]}>{t('mobile.bottlePrivacy')}</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                {t('mobile.bottlePrivacyHint')}
              </Text>
              <ChoiceChips
                value={prefs.bottle_privacy}
                options={[
                  { id: 'map_only', label: t('mobile.mapOnly') },
                  { id: 'catch_only', label: t('mobile.catchOnly') },
                  { id: 'private', label: t('mobile.visibilityPrivate') },
                ]}
                onChange={(id) => void save({ bottle_privacy: id as BottlePrivacy })}
                colors={colors}
              />
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.text }]}>{t('social.hiddenWords')}</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                {t('social.hiddenWordsHint')}
              </Text>
              <TextInput
                value={wordsInput}
                onChangeText={setWordsInput}
                onBlur={() => {
                  const hidden_words = wordsInput
                    .split(',')
                    .map((word) => word.trim())
                    .filter(Boolean)
                    .slice(0, 50);
                  void save({ hidden_words });
                }}
                placeholder={t('social.hiddenWordsHint')}
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
              />
              {saving ? <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} /> : null}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  section: { borderWidth: 1, borderRadius: 18, padding: 14 },
  label: { fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 12, marginTop: 6, lineHeight: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: '800' },
  input: { marginTop: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
});
