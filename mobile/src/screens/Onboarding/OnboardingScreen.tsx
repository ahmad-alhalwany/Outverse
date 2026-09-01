import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { useTheme } from '../../hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';

const INTEREST_GROUPS: { label: string; tags: string[] }[] = [
  { label: 'Science & Future', tags: ['space', 'astronomy', 'ai', 'technology', 'future'] },
  { label: 'History', tags: ['history', 'ancient', 'archaeology', 'civilizations'] },
  { label: 'Fantasy', tags: ['fantasy', 'magic', 'mythology', 'worldbuilding'] },
  { label: 'Philosophy', tags: ['philosophy', 'ethics', 'psychology', 'meditation'] },
  { label: 'Everyday', tags: ['nature', 'travel', 'food', 'photography', 'music'] },
  { label: 'Art & Feelings', tags: ['poetry', 'writing', 'art', 'feelings', 'memory'] },
];

const GUIDES = [
  { id: 'explorer', label: 'Explorer' },
  { id: 'creator', label: 'Creator' },
];

type Suggestion = {
  id: number;
  username: string;
  avatar?: string | null;
  bio?: string | null;
  is_following?: boolean;
};

export default function OnboardingScreen() {
  const { user, updateUser } = useAuth();
  const { colors } = useTheme();
  const { t } = useLocale();
  const [step, setStep] = useState(0);
  const [worlds, setWorlds] = useState<string[]>(['The Lab', 'The Bazaar', 'The Vault']);
  const [selectedWorlds, setSelectedWorlds] = useState<string[]>(['The Lab', 'The Bazaar', 'The Vault']);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedGuide, setSelectedGuide] = useState('explorer');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const opts = await api.getOnboardingOptions();
        if (Array.isArray(opts?.worlds) && opts.worlds.length) {
          setWorlds(opts.worlds);
          setSelectedWorlds(opts.worlds.slice(0, 3));
        }
      } catch {
        /* keep defaults */
      }
      if (user?.id) {
        try {
          const rows = await api.getSuggestions(user.id);
          setSuggestions(rows as Suggestion[]);
        } catch {
          setSuggestions([]);
        }
      }
    })();
  }, [user?.id]);

  const toggleWorld = (w: string) => {
    setSelectedWorlds((prev) =>
      prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w],
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag],
    );
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('common.actionFailed'), t('onboarding.avatarHint'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const finish = async (skip = false) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append('onboarding_completed', 'true');
      if (!skip) {
        form.append(
          'interests',
          JSON.stringify([
            ...new Set([`guide:${selectedGuide}`, ...selectedWorlds, ...selectedTags]),
          ]),
        );
        if (avatarUri) {
          form.append('avatar', {
            uri: avatarUri,
            type: 'image/jpeg',
            name: 'avatar.jpg',
          } as unknown as Blob);
        }
      }
      const data = await api.updateProfile(user.id, form);
      updateUser({
        onboarding_completed: true,
        avatar: data?.avatar || user.avatar,
        interests: Array.isArray(data?.interests)
          ? data.interests
          : [...selectedWorlds, ...selectedTags],
      });
    } catch {
      Alert.alert(t('mobile.errorTitle'), t('mobile.onboardingSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const toggleFollow = async (id: number) => {
    try {
      const data = await api.toggleFollow(id);
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, is_following: Boolean(data.is_following ?? data.following) }
            : s,
        ),
      );
    } catch {
      /* ignore */
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        <Image source={require('../../../assets/icon.png')} style={styles.logo} />
        <Text style={[styles.brand, { color: colors.text }]}>{t('mobile.welcomeTo')}</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>{t('mobile.stepOf', { n: step + 1 })}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <View>
            <Text style={[styles.title, { color: colors.text }]}>{t('mobile.chooseGuide')}</Text>
            <View style={styles.row}>
              {GUIDES.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                    selectedGuide === g.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setSelectedGuide(g.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.text },
                      selectedGuide === g.id && styles.chipTextActive,
                    ]}
                  >
                    {g.id === 'explorer' ? t('onboarding.explorer') : t('onboarding.creator')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.title, { color: colors.text, marginTop: 20 }]}>{t('mobile.worlds')}</Text>
            <View style={styles.row}>
              {worlds.map((w) => (
                <TouchableOpacity
                  key={w}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                    selectedWorlds.includes(w) && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => toggleWorld(w)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.text },
                      selectedWorlds.includes(w) && styles.chipTextActive,
                    ]}
                  >
                    {w}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.avatarBtn, { backgroundColor: colors.surfaceSecondary }]}
              onPress={() => void pickAvatar()}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <Text style={[styles.avatarBtnText, { color: colors.primary }]}>{t('mobile.addAvatar')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={[styles.title, { color: colors.text }]}>{t('mobile.interests')}</Text>
            {INTEREST_GROUPS.map((group) => (
              <View key={group.label} style={{ marginBottom: 14 }}>
                <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
                  {t(
                    group.label === 'Science & Future'
                      ? 'mobile.groupScience'
                      : group.label === 'History'
                        ? 'mobile.groupHistory'
                        : group.label === 'Fantasy'
                          ? 'mobile.groupFantasy'
                          : group.label === 'Philosophy'
                            ? 'mobile.groupPhilosophy'
                            : group.label === 'Everyday'
                              ? 'mobile.groupEveryday'
                              : 'mobile.groupArt',
                  )}
                </Text>
                <View style={styles.row}>
                  {group.tags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.chip,
                        { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                        selectedTags.includes(tag) && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: colors.text },
                          selectedTags.includes(tag) && styles.chipTextActive,
                        ]}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={[styles.title, { color: colors.text }]}>{t('mobile.peopleToFollow')}</Text>
            {suggestions.length === 0 ? (
              <Text style={[styles.muted, { color: colors.textSecondary }]}>{t('mobile.noSuggestions')}</Text>
            ) : (
              suggestions.slice(0, 12).map((s) => (
                <View key={s.id} style={[styles.suggestRow, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.suggestName, { color: colors.text }]}>@{s.username}</Text>
                    {s.bio ? (
                      <Text style={[styles.muted, { color: colors.textSecondary }]} numberOfLines={1}>
                        {s.bio}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.followBtn,
                      { backgroundColor: colors.primary },
                      s.is_following && { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
                    ]}
                    onPress={() => void toggleFollow(s.id)}
                  >
                    <Text style={[styles.followText, s.is_following && { color: colors.primary }]}>
                      {s.is_following ? t('onboarding.following') : t('onboarding.follow')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity onPress={() => void finish(true)} disabled={saving}>
          <Text style={[styles.skip, { color: colors.textSecondary }]}>{t('onboarding.skipForNow')}</Text>
        </TouchableOpacity>
        {step < 2 ? (
          <TouchableOpacity style={[styles.next, { backgroundColor: colors.primary }]} onPress={() => setStep((s) => s + 1)}>
            <Text style={styles.nextText}>{t('common.next')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.next, { backgroundColor: colors.primary }]}
            onPress={() => void finish(false)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextText}>{t('mobile.enterCosonova')}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  top: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  logo: { width: 56, height: 56, borderRadius: 14, marginBottom: 10 },
  brand: { fontSize: 22, fontWeight: '800' },
  sub: { marginTop: 4, fontWeight: '600' },
  body: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  groupLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipText: { fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  avatarBtn: {
    marginTop: 20,
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 96, height: 96 },
  avatarBtnText: { fontWeight: '700' },
  muted: { fontSize: 13 },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  suggestName: { fontWeight: '700' },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  followText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  skip: { fontWeight: '700', fontSize: 15 },
  next: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 120,
    alignItems: 'center',
  },
  nextText: { color: '#fff', fontWeight: '800' },
});
