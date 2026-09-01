import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';

const POPULAR_TAGS = [
  '#CreativeChallenge',
  '#DailyInspiration',
  '#ArtisticJourney',
  '#CreativeCommunity',
  '#DigitalArt',
  '#Inspiration',
];

const MOODS = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '🎨', label: 'Artistic' },
  { emoji: '💡', label: 'Inspired' },
  { emoji: '🎉', label: 'Energetic' },
  { emoji: '✨', label: 'Spark' },
];

type PostType = 'normal' | 'poll' | 'question';

export default function CreatePostComposer({ onPublished }: { onPublished?: () => void }) {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useLocale();
  const navigation = useNavigation<any>();
  const displayName = user?.first_name || user?.username || 'You';

  const [text, setText] = useState('');
  const [postType, setPostType] = useState<PostType>('normal');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [tags, setTags] = useState<string[]>([]);
  const [mood, setMood] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [published, setPublished] = useState(false);

  const canPublish = useMemo(() => {
    if (postType === 'poll') return pollOptions.filter((o) => o.trim()).length >= 2;
    if (postType === 'question') return !!text.trim();
    return !!(text.trim() || imageUri);
  }, [postType, pollOptions, text, imageUri]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) setImageUri(result.assets[0].uri);
  };

  const publish = async () => {
    if (!canPublish || publishing) return;
    setPublishing(true);
    setError('');
    try {
      await api.createPost({
        text: text.trim(),
        post_type: postType,
        poll_options: postType === 'poll' ? pollOptions.map((o) => o.trim()).filter(Boolean) : undefined,
        mood: mood || undefined,
        tags: tags.map((tag) => tag.replace(/^#/, '')),
        media: imageUri ? [{ uri: imageUri, type: 'image' }] : undefined,
      });
      setText('');
      setPollOptions(['', '']);
      setTags([]);
      setMood(null);
      setImageUri(null);
      setPostType('normal');
      setPublished(true);
      setTimeout(() => setPublished(false), 4000);
      onPublished?.();
    } catch {
      setError('Could not publish your post. Check the connection.');
    } finally {
      setPublishing(false);
    }
  };

  const toolBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)';

  return (
    <LinearGradient
      colors={
        isDark
          ? ['rgba(30,23,64,0.96)', 'rgba(37,27,77,0.94)', 'rgba(24,20,53,0.98)']
          : ['#FFFFFF', '#F9F3FF', '#F3F8FF']
      }
      style={[styles.card, { borderColor: isDark ? 'rgba(196,181,253,0.22)' : colors.border }]}
    >
      <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(196,181,253,0.1)' : colors.border }]}>
        <Avatar avatar={user?.avatar} name={displayName} size="md" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.text }]}>{displayName}</Text>
          <Text style={[styles.subtle, { color: colors.textSecondary }]}>Share your next creative spark</Text>
        </View>
      </View>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={
          postType === 'poll'
            ? 'Ask your poll question…'
            : postType === 'question'
              ? 'Ask the community a question…'
              : t('mobile.composePlaceholder')
        }
        placeholderTextColor={colors.textMuted}
        multiline
        style={[
          styles.textarea,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: isDark ? 'rgba(255,255,255,0.045)' : '#FFFFFF',
          },
        ]}
      />

      {postType === 'poll' ? (
        <View style={{ gap: 8, marginBottom: 12 }}>
          {pollOptions.map((option, idx) => (
            <TextInput
              key={idx}
              value={option}
              onChangeText={(value) => {
                const next = [...pollOptions];
                next[idx] = value;
                setPollOptions(next);
              }}
              placeholder={`Option ${idx + 1}`}
              placeholderTextColor={colors.textMuted}
              style={[styles.pollInput, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F3F0FC' }]}
            />
          ))}
        </View>
      ) : null}

      {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}

      <View style={[styles.toolbar, { backgroundColor: isDark ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.72)', borderColor: isDark ? 'rgba(196,181,253,0.14)' : colors.border }]}>
        {(['normal', 'poll', 'question'] as const).map((type) => {
          const active = postType === type;
          const label = type === 'normal' ? 'Normal' : type === 'poll' ? 'Poll' : 'Question';
          const icon = type === 'normal' ? 'sparkles' : type === 'poll' ? 'bar-chart-outline' : 'help-circle-outline';
          return (
            <Pressable
              key={type}
              onPress={() => setPostType(type)}
              style={[styles.tool, { backgroundColor: active ? undefined : toolBg }]}
            >
              {active ? (
                <LinearGradient colors={['#6A00FF', '#A855F7']} style={styles.toolActive}>
                  <Ionicons name={icon as never} size={16} color="#fff" />
                  <Text style={styles.toolActiveText}>{label}</Text>
                </LinearGradient>
              ) : (
                <>
                  <Ionicons name={icon as never} size={16} color={colors.icon} />
                  <Text style={[styles.toolText, { color: colors.icon }]}>{label}</Text>
                </>
              )}
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => navigation.navigate('Lab')}
          style={styles.inspireWrap}
          accessibilityLabel={t('inspiration.inspireMe')}
        >
          <LinearGradient colors={['#6A00FF', '#A855F7']} style={styles.toolActive}>
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={styles.toolActiveText}>{t('inspiration.inspireMe')}</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={() => void pickImage()} style={[styles.iconTool, { backgroundColor: toolBg }]} accessibilityLabel="Add image">
          <Ionicons name="camera-outline" size={18} color={colors.icon} />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Create', { mode: 'reel' })} style={[styles.iconTool, { backgroundColor: toolBg }]} accessibilityLabel="Add video">
          <Ionicons name="videocam-outline" size={18} color={colors.icon} />
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}># Trending Tags</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {POPULAR_TAGS.map((tag) => {
          const active = tags.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => setTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]))}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? 'rgba(124,58,237,0.28)' : isDark ? 'rgba(255,255,255,0.06)' : '#EDE4FB',
                  borderColor: active ? '#A78BFA' : colors.border,
                },
              ]}
            >
              <Text style={{ color: active ? '#E9D5FF' : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>{tag}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 14 }]}>How are you feeling?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {MOODS.map((item) => {
          const active = mood === item.emoji;
          return (
            <Pressable
              key={item.emoji}
              onPress={() => setMood(active ? null : item.emoji)}
              style={[
                styles.mood,
                {
                  backgroundColor: active ? 'rgba(124,58,237,0.22)' : isDark ? 'rgba(255,255,255,0.05)' : '#F3F0FC',
                  borderColor: active ? '#A78BFA' : colors.border,
                },
              ]}
            >
              <Text style={styles.moodEmoji}>{item.emoji}</Text>
              <Text style={[styles.moodLabel, { color: colors.textSecondary }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {published ? <Text style={styles.ok}>{t('compose.publishedSuccess')}</Text> : null}

      <View style={styles.footer}>
        <Text style={[styles.scheduled, { color: colors.textSecondary }]}>{t('compose.scheduledPanelTitle')}</Text>
        <Pressable onPress={() => void publish()} disabled={!canPublish || publishing} style={{ opacity: canPublish && !publishing ? 1 : 0.45 }}>
          <LinearGradient colors={['#7C3AED', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.publish}>
            {publishing ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishText}>{t('compose.publish')}</Text>}
          </LinearGradient>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, padding: 16, marginBottom: 20, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14, marginBottom: 14, borderBottomWidth: 1 },
  eyebrow: { fontSize: 15, fontWeight: '700' },
  subtle: { fontSize: 12, marginTop: 2 },
  textarea: {
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  pollInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  preview: { width: '100%', height: 144, borderRadius: 14, marginBottom: 12 },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 16,
  },
  tool: { borderRadius: 12, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, minHeight: 36 },
  toolText: { fontSize: 11, fontWeight: '700' },
  toolActive: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, minHeight: 36 },
  toolActiveText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  inspireWrap: { borderRadius: 12, overflow: 'hidden' },
  iconTool: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  mood: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', minWidth: 72 },
  moodEmoji: { fontSize: 18 },
  moodLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  error: { color: '#EF4444', marginTop: 10, fontSize: 13 },
  ok: { color: '#34D399', marginTop: 10, fontSize: 13 },
  footer: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scheduled: { fontSize: 12, fontWeight: '600' },
  publish: { borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12, minWidth: 108, alignItems: 'center' },
  publishText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
