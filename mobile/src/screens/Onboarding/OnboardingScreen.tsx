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
      Alert.alert('Permission needed', 'Allow photo library access to set an avatar.');
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
      Alert.alert('Error', 'Could not save onboarding. Try again.');
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Image source={require('../../../assets/icon.png')} style={styles.logo} />
        <Text style={styles.brand}>Welcome to Cosonova</Text>
        <Text style={styles.sub}>Step {step + 1} of 3</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <View>
            <Text style={styles.title}>Choose your guide</Text>
            <View style={styles.row}>
              {GUIDES.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.chip, selectedGuide === g.id && styles.chipActive]}
                  onPress={() => setSelectedGuide(g.id)}
                >
                  <Text style={[styles.chipText, selectedGuide === g.id && styles.chipTextActive]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.title, { marginTop: 20 }]}>Worlds</Text>
            <View style={styles.row}>
              {worlds.map((w) => (
                <TouchableOpacity
                  key={w}
                  style={[styles.chip, selectedWorlds.includes(w) && styles.chipActive]}
                  onPress={() => toggleWorld(w)}
                >
                  <Text style={[styles.chipText, selectedWorlds.includes(w) && styles.chipTextActive]}>
                    {w}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.avatarBtn} onPress={() => void pickAvatar()}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <Text style={styles.avatarBtnText}>Add avatar</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={styles.title}>Interests</Text>
            {INTEREST_GROUPS.map((group) => (
              <View key={group.label} style={{ marginBottom: 14 }}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                <View style={styles.row}>
                  {group.tags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.chip, selectedTags.includes(tag) && styles.chipActive]}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text
                        style={[
                          styles.chipText,
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
            <Text style={styles.title}>People to follow</Text>
            {suggestions.length === 0 ? (
              <Text style={styles.muted}>No suggestions right now — you can skip.</Text>
            ) : (
              suggestions.slice(0, 12).map((s) => (
                <View key={s.id} style={styles.suggestRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestName}>@{s.username}</Text>
                    {s.bio ? (
                      <Text style={styles.muted} numberOfLines={1}>
                        {s.bio}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={[styles.followBtn, s.is_following && styles.followingBtn]}
                    onPress={() => void toggleFollow(s.id)}
                  >
                    <Text style={[styles.followText, s.is_following && { color: '#4f46e5' }]}>
                      {s.is_following ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => void finish(true)} disabled={saving}>
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
        {step < 2 ? (
          <TouchableOpacity style={styles.next} onPress={() => setStep((s) => s + 1)}>
            <Text style={styles.nextText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.next} onPress={() => void finish(false)} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextText}>Enter Cosonova</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  top: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  logo: { width: 56, height: 56, borderRadius: 14, marginBottom: 10 },
  brand: { fontSize: 22, fontWeight: '800', color: '#312e81' },
  sub: { marginTop: 4, color: '#6b7280', fontWeight: '600' },
  body: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 12 },
  groupLabel: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#4f46e5' },
  chipText: { fontWeight: '700', color: '#374151', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  avatarBtn: {
    marginTop: 20,
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 96, height: 96 },
  avatarBtnText: { color: '#5b21b6', fontWeight: '700' },
  muted: { color: '#6b7280', fontSize: 13 },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    gap: 10,
  },
  suggestName: { fontWeight: '700', color: '#111827' },
  followBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  followingBtn: { backgroundColor: '#ede9fe' },
  followText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  skip: { color: '#6b7280', fontWeight: '700', fontSize: 15 },
  next: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 120,
    alignItems: 'center',
  },
  nextText: { color: '#fff', fontWeight: '800' },
});
