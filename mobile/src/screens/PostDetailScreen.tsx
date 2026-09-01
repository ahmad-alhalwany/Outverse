import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { api } from '@/api/client';
import type { Post } from '@/types';
import type { ReactionType } from '@/lib/reactions';
import PostCard from '@/components/PostCard';
import { openProfile } from '@/lib/nav';

export default function PostDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { t } = useLocale();
  const postId = (route.params as { postId?: string | number })?.postId;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPost = async () => {
    if (!postId) return;
    setError(false);
    try {
      setPost(await api.getPost(postId.toString()));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleReact = (type: ReactionType) => {
    if (!post) return;
    const wasSame = post.my_reaction === type;
    setPost({
      ...post,
      my_reaction: wasSame ? null : type,
      likes_count: wasSame ? post.likes_count - 1 : post.likes_count + (post.my_reaction ? 0 : 1),
    });
    api
      .reactToPost(postId!.toString(), wasSame ? null : type)
      .then((data) =>
        setPost((p) =>
          p
            ? {
                ...p,
                my_reaction: data.my_reaction,
                likes_count: data.total,
                reaction_counts: data.reaction_counts,
              }
            : p,
        ),
      )
      .catch(() => fetchPost());
  };

  useEffect(() => {
    if (!postId) {
      setLoading(false);
      setError(true);
      return;
    }
    fetchPost();
  }, [postId]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={8}>
          <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
          <Text style={[styles.backText, { color: colors.textSecondary }]}>{t('common.back')}</Text>
        </Pressable>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('common.loading')}</Text>
          </View>
        ) : error || !post ? (
          <View style={styles.center}>
            <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>{t('feed.loadError')}</Text>
            <Pressable onPress={() => { setLoading(true); void fetchPost(); }} style={[styles.retry, { backgroundColor: colors.primary }]}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>{t('feed.retry')}</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <PostCard
              post={post}
              initialCommentsOpen
              onReact={handleReact}
              onUserPress={() => openProfile(navigation, post.user?.username)}
              onVote={(vote) => {
                void (async () => {
                  try {
                    const result = await api.votePost(post.id, vote);
                    setPost((p) =>
                      p ? { ...p, vote_score: result.vote_score, my_vote: result.my_vote } : p,
                    );
                  } catch {
                    /* ignore */
                  }
                })();
              }}
            />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  hint: {
    marginTop: 10,
    fontSize: 13,
  },
  retry: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  scroll: {
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
});
