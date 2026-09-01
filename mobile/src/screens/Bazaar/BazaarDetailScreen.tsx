import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { openProfile } from '@/lib/nav';
import {
  bazaarCategoryLabel,
  bazaarOwnerName,
  formatIdeaTargetDate,
  fundingPercent,
  type BazaarIdea,
} from '@/lib/bazaar';
import {
  DeleteIdeaDialog,
  EditIdeaModal,
  PledgeSheet,
  type BazaarPalette,
} from './bazaarParts';

const PALETTES: Record<'light' | 'dark', BazaarPalette> = {
  light: {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    overlay: 'rgba(33,27,61,0.45)',
    fundedBg: '#e8f3ee',
    fundedText: '#2f8f6b',
    progressBg: 'rgba(0,0,0,0.06)',
  },
  dark: {
    cream: '#14102A',
    card: '#1E1740',
    card2: '#251B4D',
    white: '#2A2154',
    brown: '#C4B5FD',
    brownDk: '#A78BFA',
    text: '#F5F3FF',
    text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)',
    overlay: 'rgba(10,8,24,0.65)',
    fundedBg: 'rgba(74,222,128,0.15)',
    fundedText: '#4ade80',
    progressBg: 'rgba(255,255,255,0.08)',
  },
};

type IdeaComment = {
  id: number;
  content: string;
  created_at?: string;
  user?: { id?: number; username?: string; first_name?: string; last_name?: string; avatar?: string | null };
};

export default function BazaarDetailScreen() {
  const { isDark } = useTheme();
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const C = isDark ? PALETTES.dark : PALETTES.light;
  const ideaId = route.params?.ideaId as string | number;
  const shouldOpenPledge = !!route.params?.openPledge;

  const [idea, setIdea] = useState<BazaarIdea | null>(null);
  const [comments, setComments] = useState<IdeaComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState('');
  const [pledgeOpen, setPledgeOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [comment, setComment] = useState('');
  const [commenting, setCommenting] = useState(false);

  const load = useCallback(async () => {
    if (!ideaId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const [data, commentRows] = await Promise.all([
        api.getIdea(ideaId) as Promise<BazaarIdea>,
        api.getIdeaComments(ideaId).catch(() => []),
      ]);
      setIdea(data);
      setComments(commentRows as IdeaComment[]);
    } catch {
      setIdea(null);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (shouldOpenPledge && idea && !idea.is_owner) setPledgeOpen(true);
  }, [shouldOpenPledge, idea]);

  const canManage = !!(
    idea &&
    (idea.is_owner || (user?.id && idea.owner?.id && Number(user.id) === Number(idea.owner.id)))
  );
  const pct = idea ? fundingPercent(idea) : null;
  const due = idea ? formatIdeaTargetDate(idea.target_date, locale) : null;
  const owner = idea ? bazaarOwnerName(idea, t('bazaar.anonymousOwner')) : '';
  const cover = idea?.cover_url ? mediaUrl(idea.cover_url) : '';

  const handleVote = async () => {
    if (!idea) return;
    try {
      const data = await api.voteIdea(idea.id);
      setIdea((prev) =>
        prev ? { ...prev, is_voted: !!data.voted, supporters: data.supporters ?? prev.supporters } : prev,
      );
    } catch {
      setActionError(t('bazaar.voteFailed'));
    }
  };

  const handleSave = async () => {
    if (!idea) return;
    try {
      const data = await api.toggleIdeaSave(idea.id);
      setIdea((prev) => (prev ? { ...prev, is_saved: !!(data.saved ?? data.is_saved) } : prev));
    } catch {
      setActionError(t('bazaar.saveFailed'));
    }
  };

  const openPledge = () => {
    if (canManage) {
      setActionError(t('bazaar.ownerCannotPledge'));
      return;
    }
    setPledgeOpen(true);
  };

  const submitComment = async () => {
    if (!idea || !comment.trim()) {
      setActionError(t('bazaar.writeCommentFirst'));
      return;
    }
    setCommenting(true);
    try {
      const created = (await api.createIdeaComment(idea.id, comment.trim())) as IdeaComment;
      setComments((prev) => [created, ...prev]);
      setComment('');
      setIdea((prev) =>
        prev ? { ...prev, discussion_count: (prev.discussion_count ?? comments.length) + 1 } : prev,
      );
    } catch {
      setActionError(t('bazaar.postCommentFailed'));
    } finally {
      setCommenting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: C.cream }]}>
        <SafeAreaView style={styles.center} edges={['top']}>
          <ActivityIndicator color={C.brown} />
          <Text style={{ color: C.text2, marginTop: 10 }}>{t('bazaar.loading')}</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (notFound || !idea) {
    return (
      <View style={[styles.root, { backgroundColor: C.cream }]}>
        <SafeAreaView style={styles.center} edges={['top']}>
          <Text style={{ color: C.text2, marginBottom: 14 }}>{t('bazaar.ideaNotFound')}</Text>
          <Pressable onPress={() => navigation.goBack()} style={[styles.backPill, { backgroundColor: C.brownDk }]}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>{t('bazaar.backToBazaar')}</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: C.cream }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backRow}>
          <Ionicons name="chevron-back" size={18} color={C.text2} />
          <Text style={{ color: C.text2, fontWeight: '700' }}>{t('bazaar.backToBazaar')}</Text>
        </Pressable>

        {actionError ? (
          <Pressable onPress={() => setActionError('')} style={styles.errorBanner}>
            <Text style={styles.errorText}>{actionError}</Text>
          </Pressable>
        ) : null}
        {toast ? (
          <View style={styles.toast}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{toast}</Text>
          </View>
        ) : null}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={[styles.article, { backgroundColor: C.white, borderColor: C.line }]}>
              {cover ? (
                <Image source={{ uri: cover }} style={styles.cover} resizeMode="cover" />
              ) : (
                <LinearGradient colors={[C.card, C.card2]} style={styles.cover} />
              )}
              <View style={styles.body}>
                <View style={styles.chipRow}>
                  {idea.category ? (
                    <View style={[styles.chip, { backgroundColor: C.card2 }]}>
                      <Text style={[styles.chipText, { color: C.brown }]}>{bazaarCategoryLabel(idea.category, locale)}</Text>
                    </View>
                  ) : null}
                  {idea.status && idea.status !== 'proposed' ? (
                    <View style={[styles.chip, { backgroundColor: C.fundedBg }]}>
                      <Text style={[styles.chipText, { color: C.fundedText }]}>
                        {idea.status === 'in_progress' ? t('bazaar.inProgress') : t('bazaar.completed')}
                      </Text>
                    </View>
                  ) : null}
                  {idea.collab_project_id ? (
                    <Pressable
                      onPress={() => navigation.navigate('Collab', { project: idea.collab_project_id })}
                      style={[styles.chip, { backgroundColor: C.fundedBg }]}
                    >
                      <Text style={[styles.chipText, { color: C.fundedText }]}>{t('bazaar.collabActive')}</Text>
                    </Pressable>
                  ) : null}
                </View>

                <Text style={[styles.title, { color: C.text }]}>{idea.title}</Text>
                {idea.description ? (
                  <Text style={[styles.desc, { color: C.text2 }]}>{idea.description}</Text>
                ) : null}
                {due ? (
                  <View style={styles.dueRow}>
                    <Ionicons name="calendar-outline" size={15} color={C.brownDk} />
                    <Text style={{ color: C.brownDk, fontSize: 13 }}>{t('bazaar.dueBy', { date: due })}</Text>
                  </View>
                ) : null}

                {idea.tags?.length ? (
                  <View style={styles.chipRow}>
                    {idea.tags.map((tag) => (
                      <View key={tag} style={[styles.chip, { backgroundColor: C.card2 }]}>
                        <Text style={[styles.chipText, { color: C.brownDk }]}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {idea.silent_unlocked ? (
                  <View style={[styles.note, { backgroundColor: C.fundedBg }]}>
                    <Text style={{ color: C.fundedText, fontWeight: '600' }}>{t('bazaar.silentUnlocked')}</Text>
                  </View>
                ) : null}

                <View style={[styles.fundCard, { backgroundColor: C.card2, borderColor: C.line }]}>
                  <Text style={[styles.sectionTitle, { color: C.text }]}>{t('bazaar.pledge')}</Text>
                  {pct != null ? (
                    <>
                      <View style={[styles.track, { backgroundColor: C.progressBg }]}>
                        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: C.brown }]} />
                      </View>
                      <Text style={{ color: C.text2, fontSize: 13, marginTop: 8 }}>
                        ${Number(idea.funding_raised || 0).toLocaleString()} {t('bazaar.raised')} · $
                        {Number(idea.funding_goal || 0).toLocaleString()} {t('bazaar.goal')} · {pct}%
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: C.text2, fontSize: 13 }}>{t('bazaar.pledgeConfirm')}</Text>
                  )}
                  {!canManage ? (
                    <Pressable onPress={openPledge} style={{ marginTop: 14 }}>
                      <LinearGradient colors={[C.brown, C.brownDk]} style={styles.pledgeCta}>
                        <Ionicons name="heart" size={16} color="#fff" />
                        <Text style={styles.pledgeCtaText}>{t('bazaar.pledgeCta')}</Text>
                      </LinearGradient>
                    </Pressable>
                  ) : (
                    <Text style={{ color: C.text2, marginTop: 10, fontSize: 13 }}>{t('bazaar.ownerCannotPledge')}</Text>
                  )}
                </View>

                {idea.roles_needed?.length ? (
                  <View style={styles.chipRow}>
                    {idea.roles_needed.map((role) => (
                      <View key={role} style={[styles.chip, { backgroundColor: C.card2 }]}>
                        <Text style={[styles.chipText, { color: C.text }]}>{role}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {idea.milestones?.length ? (
                  <View style={[styles.block, { backgroundColor: C.card2, borderColor: C.line }]}>
                    <Text style={[styles.sectionTitle, { color: C.text }]}>{t('bazaar.milestones')}</Text>
                    {idea.milestones.map((milestone, index) => (
                      <View key={milestone.id || index} style={styles.milestoneRow}>
                        <Text style={{ color: milestone.done ? C.fundedText : C.text2 }}>
                          {milestone.done ? '✓' : '○'}
                        </Text>
                        <Text
                          style={{
                            color: milestone.done ? C.text2 : C.text,
                            textDecorationLine: milestone.done ? 'line-through' : 'none',
                            flex: 1,
                          }}
                        >
                          {milestone.title}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={[styles.metaBar, { borderColor: C.line }]}>
                  <Pressable
                    onPress={() => openProfile(navigation, idea.owner?.username, user?.username)}
                    style={styles.ownerHit}
                  >
                    {idea.owner?.avatar ? (
                      <Image source={{ uri: mediaUrl(idea.owner.avatar) }} style={styles.ownerAvatar} />
                    ) : (
                      <View style={[styles.ownerAvatar, { backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: C.brown, fontWeight: '800' }}>{owner[0]?.toUpperCase() || '?'}</Text>
                      </View>
                    )}
                    <Text style={{ color: C.brown, fontWeight: '700' }}>{owner}</Text>
                  </Pressable>
                  <View style={styles.metaStats}>
                    <Text style={{ color: C.text2, fontSize: 12 }}>
                      {idea.collaborators_count ?? idea.collaborators?.length ?? 0} {t('bazaar.collaborators')}
                    </Text>
                    <Text style={{ color: C.text2, fontSize: 12 }}>
                      {idea.discussion_count ?? comments.length} {t('bazaar.commentsCount', { n: comments.length })}
                    </Text>
                  </View>
                </View>

                <View style={styles.actions}>
                  <Pressable onPress={() => void handleVote()}>
                    <LinearGradient colors={[C.brown, C.brownDk]} style={styles.actionPrimary}>
                      <Ionicons name={idea.is_voted ? 'heart' : 'heart-outline'} size={18} color="#fff" />
                      <Text style={styles.actionPrimaryText}>
                        {idea.is_voted ? t('bazaar.supported') : t('bazaar.supportIdea')}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleSave()}
                    style={[
                      styles.actionSecondary,
                      { backgroundColor: idea.is_saved ? C.fundedBg : C.card2, borderColor: C.line },
                    ]}
                  >
                    <Ionicons
                      name={idea.is_saved ? 'bookmark' : 'bookmark-outline'}
                      size={18}
                      color={idea.is_saved ? C.fundedText : C.brownDk}
                    />
                    <Text style={{ color: idea.is_saved ? C.fundedText : C.brownDk, fontWeight: '800' }}>
                      {idea.is_saved ? t('bazaar.savedIdea') : t('bazaar.bookmarkIdea')}
                    </Text>
                  </Pressable>
                  {!canManage ? (
                    <Pressable
                      onPress={openPledge}
                      style={[styles.actionSecondary, { backgroundColor: C.card2, borderColor: C.line }]}
                    >
                      <Ionicons name="wallet-outline" size={18} color={C.brownDk} />
                      <Text style={{ color: C.brownDk, fontWeight: '800' }}>{t('bazaar.pledge')}</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.manageRow}>
                      <Pressable
                        onPress={() => setEditing(true)}
                        style={[styles.actionSecondary, { flex: 1, backgroundColor: C.card2, borderColor: C.line }]}
                      >
                        <Ionicons name="create-outline" size={16} color={C.brownDk} />
                        <Text style={{ color: C.brownDk, fontWeight: '800' }}>{t('bazaar.editIdea')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setDeleting(true)}
                        style={[styles.actionSecondary, { flex: 1, backgroundColor: C.brownDk, borderColor: C.brownDk }]}
                      >
                        <Ionicons name="trash-outline" size={16} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '800' }}>{t('bazaar.deleteIdea')}</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
                <Text style={[styles.supporters, { color: C.text2 }]}>
                  {idea.supporters ?? 0} {t('bazaar.supporters')}
                </Text>
              </View>
            </View>

            <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
              <Text style={[styles.sectionTitle, { color: C.text }]}>{t('bazaar.recentPledges')}</Text>
              {idea.pledges?.length ? (
                idea.pledges.map((pledge, index) => {
                  const name = pledge.is_anonymous
                    ? null
                    : `${pledge.user?.first_name || ''} ${pledge.user?.last_name || ''}`.trim() ||
                      pledge.user?.username;
                  return (
                    <Text key={pledge.id || index} style={{ color: C.text2, marginBottom: 8, lineHeight: 20 }}>
                      {name
                        ? t('bazaar.pledgedAmount', { name, amount: pledge.amount ?? 0 })
                        : t('bazaar.pledgedAnonymous', { amount: pledge.amount ?? 0 })}
                    </Text>
                  );
                })
              ) : (
                <Text style={{ color: C.text2 }}>{t('bazaar.noPledges')}</Text>
              )}
            </View>

            <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
              <View style={styles.discussHead}>
                <Text style={[styles.sectionTitle, { color: C.text, marginBottom: 0 }]}>{t('bazaar.discussionTitle')}</Text>
                <Text style={{ color: C.text2, fontSize: 12 }}>{t('bazaar.commentsCount', { n: comments.length })}</Text>
              </View>
              <View style={[styles.commentBox, { backgroundColor: C.card2, borderColor: C.line }]}>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder={t('bazaar.commentPlaceholder')}
                  placeholderTextColor={C.text2}
                  multiline
                  style={[styles.commentInput, { color: C.text }]}
                />
                <Pressable
                  onPress={() => void submitComment()}
                  disabled={commenting}
                  style={[styles.commentBtn, { backgroundColor: C.brownDk, opacity: commenting ? 0.65 : 1 }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '800' }}>
                    {commenting ? t('bazaar.postingComment') : t('bazaar.postComment')}
                  </Text>
                </Pressable>
              </View>
              {comments.map((row) => {
                const name =
                  `${row.user?.first_name || ''} ${row.user?.last_name || ''}`.trim() ||
                  row.user?.username ||
                  t('bazaar.anonymousOwner');
                return (
                  <View key={row.id} style={[styles.commentRow, { borderColor: C.line }]}>
                    <Text style={{ color: C.text, fontWeight: '700' }}>{name}</Text>
                    <Text style={{ color: C.text2, marginTop: 4, lineHeight: 20 }}>{row.content}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {pledgeOpen ? (
        <PledgeSheet
          idea={idea}
          C={C}
          t={t}
          onClose={() => setPledgeOpen(false)}
          onPledged={(funding_raised) => {
            setIdea((prev) => (prev ? { ...prev, funding_raised } : prev));
            setPledgeOpen(false);
            setToast(t('bazaar.pledge'));
            setTimeout(() => setToast(''), 2200);
            void load();
          }}
        />
      ) : null}
      {editing ? (
        <EditIdeaModal
          idea={idea}
          C={C}
          t={t}
          locale={locale}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      ) : null}
      {deleting ? (
        <DeleteIdeaDialog
          idea={idea}
          C={C}
          t={t}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false);
            navigation.goBack();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backPill: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8 },
  errorBanner: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#FEE2E2', borderRadius: 12, padding: 10 },
  errorText: { color: '#B91C1C', fontSize: 13 },
  toast: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#2f8f6b', borderRadius: 12, padding: 10 },
  content: { padding: 16, paddingBottom: 40 },
  article: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, marginBottom: 14 },
  cover: { width: '100%', height: 196 },
  body: { padding: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', lineHeight: 32 },
  desc: { fontSize: 15, lineHeight: 22, marginTop: 10 },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  note: { borderRadius: 12, padding: 12, marginBottom: 12 },
  fundCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  track: { height: 10, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  pledgeCta: { borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  pledgeCtaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  block: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14 },
  milestoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  metaBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, paddingTop: 14, marginTop: 6, marginBottom: 14 },
  ownerHit: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  ownerAvatar: { width: 32, height: 32, borderRadius: 16 },
  metaStats: { alignItems: 'flex-end', gap: 2 },
  actions: { gap: 10 },
  actionPrimary: { borderRadius: 14, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionPrimaryText: { color: '#fff', fontWeight: '800' },
  actionSecondary: { borderRadius: 14, minHeight: 48, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  manageRow: { flexDirection: 'row', gap: 8 },
  supporters: { textAlign: 'center', marginTop: 10, fontSize: 12 },
  panel: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 14 },
  discussHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  commentBox: { borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: 12 },
  commentInput: { minHeight: 72, fontSize: 15, textAlignVertical: 'top' },
  commentBtn: { alignSelf: 'flex-end', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginTop: 8 },
  commentRow: { borderTopWidth: 1, paddingTop: 10, marginTop: 10 },
});
