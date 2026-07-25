import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import type { Post, Comment } from '@/types';
import type { ReactionType } from '@/lib/reactions';
import PostCard from '@/components/PostCard';
import ReactionPicker from '@/components/ReactionPicker';

export default function PostDetailScreen() {
  const route = useRoute();
  const { colors } = useTheme();
  const postId = (route.params as any)?.postId as string | number;
  const postIdStr = postId?.toString() || '';
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  const fetchPost = async () => {
    try {
      setPost(await api.getPost(postIdStr));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await api.getComments(postIdStr);
      setComments(response.results || response);
    } catch {
      /* ignore */
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
    api.reactToPost(postIdStr, type)
      .then((data) => setPost((p) => (p ? { ...p, my_reaction: data.my_reaction, likes_count: data.total, reaction_counts: data.reaction_counts } : p)))
      .catch(() => fetchPost());
  };

  const handleAddComment = async () => {
    const text = newComment.trim();
    if (!text) return;
    setNewComment('');
    try {
      await api.createComment(postIdStr, text);
      fetchComments();
    } catch {
      setNewComment(text);
    }
  };

  useEffect(() => {
    if (!postId) return;
    fetchPost();
    fetchComments();
  }, [postId]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textSecondary }}>المنشور غير موجود</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={comments}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item }) => <CommentRow comment={item} colors={colors} onChanged={fetchComments} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<PostCard post={post} onReact={handleReact} />}
        ListFooterComponent={
          <View style={styles.commentInputWrapper}>
            <TextInput
              style={[styles.commentInput, { color: colors.text, backgroundColor: colors.surface }]}
              placeholder="أضف تعليقاً..."
              placeholderTextColor={colors.textSecondary}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={280}
              onSubmitEditing={handleAddComment}
            />
            <TouchableOpacity style={[styles.sendButton, { backgroundColor: colors.primary }]} onPress={handleAddComment} disabled={!newComment.trim()}>
              <Text style={styles.sendButtonText}>➤</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function CommentRow({ comment, colors, onChanged }: { comment: Comment; colors: any; onChanged: () => void }) {
  const handleReact = (type: ReactionType) => {
    api.reactToComment(String(comment.id), type).then(onChanged).catch(() => {});
  };
  return (
    <View style={[styles.commentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.commentAuthor, { color: colors.text }]}>{comment.user?.display_name || comment.user?.username}</Text>
      <Text style={[styles.commentText, { color: colors.text }]}>{comment.text}</Text>
      <ReactionPicker
        selectedReaction={(comment.my_reaction as ReactionType | null) ?? null}
        reactionCounts={comment.reaction_counts}
        onReact={handleReact}
      />
      {comment.replies && comment.replies.length > 0 && (
        <View style={styles.replies}>
          {comment.replies.map((reply) => (
            <View key={reply.id} style={styles.reply}>
              <Text style={[styles.commentAuthor, { color: colors.text }]}>{reply.user?.display_name || reply.user?.username}</Text>
              <Text style={[styles.commentText, { color: colors.text }]}>{reply.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 12, paddingBottom: 100 },
  commentInputWrapper: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 8 },
  commentInput: { flex: 1, fontSize: 16, minHeight: 40, maxHeight: 100, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, marginRight: 8 },
  sendButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  commentCard: { marginBottom: 10, borderRadius: 14, padding: 12, borderWidth: StyleSheet.hairlineWidth },
  commentAuthor: { fontWeight: '700', fontSize: 13, marginBottom: 4 },
  commentText: { fontSize: 15, lineHeight: 21 },
  replies: { marginTop: 8, marginLeft: 20, borderLeftWidth: 1, borderLeftColor: '#e5e7eb', paddingLeft: 12 },
  reply: { marginBottom: 8 },
});
