import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Avatar from './Avatar';
import PostReactions from './PostReactions';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useLocale } from '@/i18n/LocaleProvider';
import { useTheme } from '@/hooks/useTheme';
import { displayName } from '@/lib/names';
import { openProfile } from '@/lib/nav';
import type { ReactionType } from '@/lib/reactions';
import type { Comment } from '@/types';

type SortKey = 'best' | 'new' | 'old' | 'controversial';

function formatTime(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

function patchTree(list: Comment[], id: string | number, patch: Partial<Comment>): Comment[] {
  return list.map((c) => {
    if (String(c.id) === String(id)) return { ...c, ...patch };
    if (c.replies?.length) {
      const replies = patchTree(c.replies, id, patch);
      if (replies !== c.replies) return { ...c, replies };
    }
    return c;
  });
}

function insertReply(list: Comment[], parentId: string | number, reply: Comment): Comment[] {
  return list.map((c) => {
    if (String(c.id) === String(parentId)) return { ...c, replies: [...(c.replies || []), reply] };
    if (c.replies?.length) {
      const replies = insertReply(c.replies, parentId, reply);
      if (replies !== c.replies) return { ...c, replies };
    }
    return c;
  });
}

export default function CommentsThread({
  postId,
  postOwnerId,
  open,
  onAdded,
}: {
  postId: string | number;
  postOwnerId?: string | number;
  open: boolean;
  onAdded?: () => void;
}) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [sort, setSort] = useState<SortKey>('best');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const page = await api.getComments(postId, { sort });
      const rows = page.results || [];
      setComments(rows);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [postId, sort]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const send = async (parent?: string | number, body?: string) => {
    const value = (body ?? text).trim();
    if (!value || sending) return;
    setSending(true);
    try {
      const created = await api.createComment(postId, value, parent);
      if (parent) {
        setComments((prev) => insertReply(prev, parent, created));
      } else {
        setComments((prev) => [...prev, created]);
        setText('');
        onAdded?.();
      }
    } catch {
      /* keep draft */
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <View style={[styles.panel, { borderTopColor: colors.border }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>{t('feed.comments')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {comments.length === 0 ? t('feed.commentsEmpty') : `${comments.length}`}
          </Text>
        </View>
        <View style={[styles.sortBadge, { borderColor: colors.border }]}>
          <Ionicons name="chatbubbles-outline" size={14} color={colors.primaryLight} />
          <Text style={[styles.sortBadgeText, { color: colors.textSecondary }]}>
            {t(`feed.sort_${sort === 'old' ? 'old' : sort}`)}
          </Text>
        </View>
      </View>

      <View style={[styles.composer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
        <Avatar name={displayName(user)} avatar={user?.avatar} size="sm" />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('feed.commentPlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text }]}
          multiline
        />
        <Pressable
          onPress={() => void send()}
          disabled={!text.trim() || sending}
          style={[styles.send, { backgroundColor: colors.primary, opacity: text.trim() ? 1 : 0.45 }]}
          accessibilityRole="button"
          accessibilityLabel={t('feed.reply')}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="paper-plane" size={16} color="#fff" />
          )}
        </Pressable>
      </View>

      <View style={styles.sortRow}>
        {(['best', 'new', 'old', 'controversial'] as const).map((key) => (
          <Pressable
            key={key}
            onPress={() => setSort(key)}
            style={[
              styles.sortChip,
              {
                backgroundColor: sort === key ? 'rgba(124,58,237,0.28)' : 'transparent',
                borderColor: sort === key ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={{ color: sort === key ? colors.text : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
              {t(`feed.sort_${key}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
      ) : error ? (
        <Pressable onPress={() => void load()} style={styles.retry}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('feed.commentsLoadError')}</Text>
        </Pressable>
      ) : (
        comments.map((c) => (
          <CommentRow
            key={String(c.id)}
            comment={c}
            postOwnerId={postOwnerId}
            depth={0}
            onPatched={(id, patch) => setComments((prev) => patchTree(prev, id, patch))}
            onReply={async (parentId, body) => {
              try {
                const created = await api.createComment(postId, body, parentId);
                setComments((prev) => insertReply(prev, parentId, created));
                onAdded?.();
              } catch {
                /* ignore */
              }
            }}
          />
        ))
      )}
    </View>
  );
}

function CommentRow({
  comment,
  postOwnerId,
  depth,
  onPatched,
  onReply,
}: {
  comment: Comment;
  postOwnerId?: string | number;
  depth: number;
  onPatched: (id: string | number, patch: Partial<Comment>) => void;
  onReply: (parentId: string | number, text: string) => Promise<void>;
}) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const name = displayName(comment.user);
  const isHost = comment.is_post_author || String(comment.user?.id) === String(postOwnerId);
  const replyCount = comment.replies?.length || 0;
  const voteScore = comment.vote_score ?? 0;

  const vote = async (next: 'boost' | 'dim') => {
    const current = comment.my_vote;
    const voteValue = current === next ? null : next;
    try {
      const data = await api.voteComment(comment.id, voteValue);
      onPatched(comment.id, {
        vote_score: data.vote_score,
        my_vote: data.my_vote,
      });
    } catch {
      /* ignore */
    }
  };

  const react = (type: ReactionType) => {
    const same = comment.my_reaction === type;
    api
      .reactToComment(comment.id, same ? null : type)
      .then((data) =>
        onPatched(comment.id, {
          my_reaction: data.my_reaction,
          reaction_counts: data.reaction_counts,
        }),
      )
      .catch(() => {});
  };

  return (
    <View style={[styles.comment, depth > 0 && styles.replyIndent]}>
      <View style={styles.voteCol}>
        <Pressable onPress={() => void vote('boost')} hitSlop={6}>
          <Ionicons
            name="caret-up"
            size={16}
            color={comment.my_vote === 'boost' ? '#A78BFA' : colors.textSecondary}
          />
        </Pressable>
        <Text
          style={[
            styles.score,
            { color: voteScore > 0 ? '#A78BFA' : voteScore < 0 ? '#22D3EE' : colors.textSecondary },
          ]}
        >
          {voteScore}
        </Text>
        <Pressable onPress={() => void vote('dim')} hitSlop={6}>
          <Ionicons
            name="caret-down"
            size={16}
            color={comment.my_vote === 'dim' ? '#22D3EE' : colors.textSecondary}
          />
        </Pressable>
      </View>
      <Pressable onPress={() => openProfile(navigation, comment.user?.username)}>
        <Avatar name={name} avatar={comment.user?.avatar} size={depth > 0 ? 'xs' : 'sm'} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.bubble}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {name}
            </Text>
            {isHost ? (
              <Text style={styles.hostBadge}>{t('comments.hostBadge')}</Text>
            ) : null}
            {comment.is_pinned ? (
              <Text style={styles.pinBadge}>{t('comments.pinned')}</Text>
            ) : null}
          </View>
          {comment.text ? (
            <Text style={[styles.body, { color: colors.text }]}>{comment.text}</Text>
          ) : null}
          <View style={styles.meta}>
            <PostReactions
              compact
              selectedReaction={(comment.my_reaction as ReactionType | null) ?? null}
              reactionCounts={comment.reaction_counts}
              onReact={react}
            />
            <Pressable onPress={() => setReplyOpen((v) => !v)} hitSlop={8}>
              <Text style={[styles.replyBtn, { color: colors.textSecondary }]}>{t('feed.reply')}</Text>
            </Pressable>
            {replyCount > 0 ? (
              <Pressable onPress={() => setCollapsed((v) => !v)} hitSlop={8}>
                <Text style={[styles.replyBtn, { color: colors.textSecondary }]}>
                  {collapsed ? `＋ ${replyCount} ${t('feed.replies')}` : `－ ${t('feed.collapse')}`}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {replyOpen ? (
            <View style={styles.replyComposer}>
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                placeholder={t('comments.replyPlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={[styles.replyInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                autoFocus
              />
              <Pressable
                onPress={async () => {
                  const value = replyText.trim();
                  if (!value) return;
                  setReplyText('');
                  setReplyOpen(false);
                  await onReply(comment.id, value);
                }}
                style={[styles.send, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="paper-plane" size={14} color="#fff" />
              </Pressable>
            </View>
          ) : null}
          {!collapsed && comment.replies?.map((r) => (
            <CommentRow
              key={String(r.id)}
              comment={r}
              postOwnerId={postOwnerId}
              depth={Math.min(depth + 1, 6)}
              onPatched={onPatched}
              onReply={onReply}
            />
          ))}
        </View>
        <Text style={[styles.time, { color: colors.textMuted }]}>{formatTime(comment.created_at)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sortBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    minHeight: 36,
    maxHeight: 90,
    paddingVertical: 6,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  sortChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  retry: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(106,0,255,0.08)',
  },
  replyIndent: {
    marginTop: 4,
    paddingTop: 8,
    borderBottomWidth: 0,
  },
  voteCol: {
    alignItems: 'center',
    width: 22,
    paddingTop: 2,
  },
  score: {
    fontSize: 11,
    fontWeight: '800',
  },
  bubble: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 13,
    fontWeight: '800',
  },
  hostBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C4B5FD',
    backgroundColor: 'rgba(124,58,237,0.22)',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pinBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FBBF24',
    backgroundColor: 'rgba(251,191,36,0.16)',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 4,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  replyBtn: {
    fontSize: 12,
    fontWeight: '700',
  },
  replyComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  time: {
    fontSize: 11,
    marginTop: 4,
  },
});
