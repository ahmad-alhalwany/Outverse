import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  WorldBackdrop,
  WorldHeader,
  WorldHero,
  WorldPrimaryButton,
} from '@/components/world/WorldChrome';
import {
  asFailedIdeaComments,
  asFailedIdeas,
  exhibitionLabelKey,
  MUSEUM_EXHIBITION_LABEL,
  MUSEUM_EXHIBITIONS,
  MUSEUM_SORT_LABEL,
  MUSEUM_SORTS,
  useMuseumPalette,
  type FailedIdea,
  type FailedIdeaComment,
  type MuseumExhibition,
  type MuseumPalette,
  type MuseumSort,
} from '@/lib/museum';

export default function MuseumScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const C = useMuseumPalette(isDark);
  const { t } = useLocale();

  const [items, setItems] = useState<FailedIdea[]>([]);
  const [exhibition, setExhibition] = useState<MuseumExhibition>('all');
  const [sort, setSort] = useState<MuseumSort>('new');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [submitOpen, setSubmitOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lesson, setLesson] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [submitExhibition, setSubmitExhibition] = useState<Exclude<MuseumExhibition, 'all'>>('burned_ideas');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [active, setActive] = useState<FailedIdea | null>(null);
  const [comments, setComments] = useState<FailedIdeaComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const data = await api.getFailedIdeas({ exhibition, ordering: sort });
      setItems(asFailedIdeas(data));
    } catch {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [exhibition, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchItem = (id: number, apply: (it: FailedIdea) => FailedIdea) => {
    setItems((prev) => prev.map((it) => (it.id === id ? apply(it) : it)));
    setActive((prev) => (prev && prev.id === id ? apply(prev) : prev));
  };

  const openSubmit = () => {
    setSubmitExhibition(exhibition === 'all' ? 'burned_ideas' : exhibition);
    setSubmitError('');
    setSubmitOpen(true);
  };

  const submit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await api.createFailedIdea({
        title: title.trim(),
        description: description.trim(),
        lesson_learned: lesson.trim(),
        cover_url: coverUrl.trim(),
        exhibition: submitExhibition,
      });
      setSubmitOpen(false);
      setTitle('');
      setDescription('');
      setLesson('');
      setCoverUrl('');
      await load(true);
    } catch {
      setSubmitError(t('museum.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (item: FailedIdea) => {
    setActive(item);
    setComments([]);
    setCommentText('');
    setCommentError('');
    setCommentsLoading(true);
    try {
      const data = await api.getFailedIdeaComments(item.id);
      setComments(asFailedIdeaComments(data));
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const toggleLike = async (item: FailedIdea) => {
    if (!user) return;
    const wasLiked = item.is_liked;
    const prevCount = item.likes_count;
    patchItem(item.id, (it) => ({
      ...it,
      is_liked: !wasLiked,
      likes_count: prevCount + (wasLiked ? -1 : 1),
    }));
    try {
      const data = await api.likeFailedIdea(item.id);
      patchItem(item.id, (it) => ({
        ...it,
        is_liked: data.liked,
        likes_count: data.likes_count,
      }));
    } catch {
      patchItem(item.id, (it) => ({ ...it, is_liked: wasLiked, likes_count: prevCount }));
    }
  };

  const postComment = async () => {
    if (!active || !commentText.trim()) return;
    const text = commentText.trim();
    setCommentText('');
    setCommentError('');
    try {
      const comment = (await api.postFailedIdeaComment(active.id, text)) as FailedIdeaComment;
      setComments((prev) => [...prev, comment]);
      patchItem(active.id, (it) => ({ ...it, comments_count: it.comments_count + 1 }));
    } catch {
      setCommentText(text);
      setCommentError(t('museum.commentFailed'));
    }
  };

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('museum.title')}
          subtitle={t('nav.museum')}
          tone="default"
          onBack={() => navigation.goBack()}
          right={
            user ? (
              <Pressable onPress={openSubmit} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('museum.submit')}>
                <Ionicons name="add" size={24} color={C.brown} />
              </Pressable>
            ) : null
          }
        />
        {loading && items.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.brown} />
            <Text style={[styles.hint, { color: C.text2 }]}>{t('common.loading')}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />
            }
          >
            <WorldHero
              tone="default"
              eyebrow="🏛"
              title={t('museum.title')}
              body={t('museum.subtitle')}
              action={
                user ? (
                  <WorldPrimaryButton label={t('museum.submit')} tone="default" onPress={openSubmit} />
                ) : undefined
              }
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {MUSEUM_EXHIBITIONS.map((key) => (
                <Chip
                  key={key}
                  label={t(MUSEUM_EXHIBITION_LABEL[key])}
                  active={exhibition === key}
                  C={C}
                  onPress={() => setExhibition(key)}
                />
              ))}
            </ScrollView>
            <View style={styles.sortRow}>
              {MUSEUM_SORTS.map((key) => (
                <Chip
                  key={key}
                  label={t(MUSEUM_SORT_LABEL[key])}
                  active={sort === key}
                  C={C}
                  compact
                  onPress={() => setSort(key)}
                />
              ))}
            </View>

            {error ? (
              <View style={[styles.empty, { backgroundColor: C.card2 }]}>
                <Text style={[styles.emptyText, { color: C.text2 }]}>{t('museum.loadError')}</Text>
                <Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: C.brownDk }]}>
                  <Text style={styles.retryText}>{t('museum.retry')}</Text>
                </Pressable>
              </View>
            ) : items.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: C.card2 }]}>
                <Text style={styles.emptyEmoji}>🏛</Text>
                <Text style={[styles.emptyText, { color: C.text2 }]}>{t('museum.empty')}</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {items.map((item) => (
                  <ExhibitCard
                    key={item.id}
                    item={item}
                    C={C}
                    t={t}
                    onOpen={() => void openDetail(item)}
                    onLike={() => void toggleLike(item)}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <SubmitModal
        visible={submitOpen}
        C={C}
        t={t}
        title={title}
        description={description}
        lesson={lesson}
        coverUrl={coverUrl}
        exhibition={submitExhibition}
        submitting={submitting}
        error={submitError}
        onChangeTitle={setTitle}
        onChangeDescription={setDescription}
        onChangeLesson={setLesson}
        onChangeCoverUrl={setCoverUrl}
        onChangeExhibition={setSubmitExhibition}
        onClose={() => setSubmitOpen(false)}
        onSubmit={() => void submit()}
      />

      <DetailModal
        visible={!!active}
        item={active}
        comments={comments}
        commentsLoading={commentsLoading}
        commentText={commentText}
        commentError={commentError}
        signedIn={!!user}
        C={C}
        t={t}
        onChangeComment={setCommentText}
        onClose={() => setActive(null)}
        onLike={() => active && void toggleLike(active)}
        onPost={() => void postComment()}
      />
    </WorldBackdrop>
  );
}

function Chip({
  label,
  active,
  C,
  onPress,
  compact,
}: {
  label: string;
  active: boolean;
  C: MuseumPalette;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        compact && styles.chipCompact,
        {
          backgroundColor: active ? C.brown : C.white,
          borderColor: active ? C.brown : C.line,
        },
      ]}
    >
      <Text style={{ color: active ? '#fff' : C.text2, fontWeight: '700', fontSize: compact ? 12 : 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ExhibitCard({
  item,
  C,
  t,
  onOpen,
  onLike,
}: {
  item: FailedIdea;
  C: MuseumPalette;
  t: (key: string) => string;
  onOpen: () => void;
  onLike: () => void;
}) {
  const cover = mediaUrl(item.cover_url);
  return (
    <Pressable onPress={onOpen} style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}>
      {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : null}
      <View style={styles.cardBody}>
        <Text style={[styles.badge, { backgroundColor: C.card2, color: C.brownDk }]}>
          {t(exhibitionLabelKey(item.exhibition))}
        </Text>
        <Text style={[styles.cardTitle, { color: C.text }]}>{item.title}</Text>
        {item.description ? (
          <Text style={[styles.cardDesc, { color: C.text2 }]} numberOfLines={3}>
            {item.description}
          </Text>
        ) : null}
        {item.lesson_learned ? (
          <Text style={[styles.lesson, { color: C.brown }]} numberOfLines={2}>
            💡 {item.lesson_learned}
          </Text>
        ) : null}
        <View style={[styles.cardFooter, { borderTopColor: C.line }]}>
          <Text style={[styles.meta, { color: C.text2 }]}>@{item.user?.username || '—'}</Text>
          <View style={styles.stats}>
            <Pressable onPress={onLike} hitSlop={8} style={styles.statBtn}>
              <Ionicons name={item.is_liked ? 'heart' : 'heart-outline'} size={16} color={item.is_liked ? '#DC2626' : C.text2} />
              <Text style={{ color: item.is_liked ? '#DC2626' : C.text2, fontSize: 12 }}>{item.likes_count ?? 0}</Text>
            </Pressable>
            <View style={styles.statBtn}>
              <Ionicons name="chatbubble-outline" size={15} color={C.text2} />
              <Text style={{ color: C.text2, fontSize: 12 }}>{item.comments_count ?? 0}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function SubmitModal({
  visible,
  C,
  t,
  title,
  description,
  lesson,
  coverUrl,
  exhibition,
  submitting,
  error,
  onChangeTitle,
  onChangeDescription,
  onChangeLesson,
  onChangeCoverUrl,
  onChangeExhibition,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  C: MuseumPalette;
  t: (key: string) => string;
  title: string;
  description: string;
  lesson: string;
  coverUrl: string;
  exhibition: Exclude<MuseumExhibition, 'all'>;
  submitting: boolean;
  error: string;
  onChangeTitle: (v: string) => void;
  onChangeDescription: (v: string) => void;
  onChangeLesson: (v: string) => void;
  onChangeCoverUrl: (v: string) => void;
  onChangeExhibition: (v: Exclude<MuseumExhibition, 'all'>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
        <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: C.cream, borderColor: C.line }]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
            <Text style={[styles.modalTitle, { color: C.text }]}>{t('museum.submit')}</Text>
            <Field value={title} onChange={onChangeTitle} placeholder={t('museum.formTitle')} C={C} />
            <Field
              value={description}
              onChange={onChangeDescription}
              placeholder={t('museum.formDescription')}
              C={C}
              multiline
            />
            <Field value={lesson} onChange={onChangeLesson} placeholder={t('museum.formLesson')} C={C} multiline />
            <Field value={coverUrl} onChange={onChangeCoverUrl} placeholder={t('museum.formCoverUrl')} C={C} />
            <View style={styles.chipsWrap}>
              {MUSEUM_EXHIBITIONS.filter((key) => key !== 'all').map((key) => (
                <Chip
                  key={key}
                  label={t(MUSEUM_EXHIBITION_LABEL[key])}
                  active={exhibition === key}
                  C={C}
                  compact
                  onPress={() => onChangeExhibition(key)}
                />
              ))}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={onClose} style={[styles.modalBtn, { backgroundColor: C.card2 }]}>
                <Text style={{ color: C.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={onSubmit}
                disabled={submitting || !title.trim()}
                style={[styles.modalBtn, { backgroundColor: C.brownDk, opacity: submitting || !title.trim() ? 0.55 : 1 }]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{t('museum.submit')}</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DetailModal({
  visible,
  item,
  comments,
  commentsLoading,
  commentText,
  commentError,
  signedIn,
  C,
  t,
  onChangeComment,
  onClose,
  onLike,
  onPost,
}: {
  visible: boolean;
  item: FailedIdea | null;
  comments: FailedIdeaComment[];
  commentsLoading: boolean;
  commentText: string;
  commentError: string;
  signedIn: boolean;
  C: MuseumPalette;
  t: (key: string) => string;
  onChangeComment: (v: string) => void;
  onClose: () => void;
  onLike: () => void;
  onPost: () => void;
}) {
  if (!item) return null;
  const cover = mediaUrl(item.cover_url);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
        <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: C.cream, borderColor: C.line, maxHeight: '88%' }]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
            {cover ? <Image source={{ uri: cover }} style={styles.detailCover} /> : null}
            <Text style={[styles.badge, { backgroundColor: C.card2, color: C.brownDk, alignSelf: 'flex-start' }]}>
              {t(exhibitionLabelKey(item.exhibition))}
            </Text>
            <Text style={[styles.detailTitle, { color: C.text }]}>{item.title}</Text>
            {item.description ? <Text style={[styles.cardDesc, { color: C.text2 }]}>{item.description}</Text> : null}
            {item.lesson_learned ? (
              <Text style={[styles.lesson, { color: C.brown, fontSize: 14 }]}>💡 {item.lesson_learned}</Text>
            ) : null}
            <View style={styles.detailMeta}>
              <Text style={[styles.meta, { color: C.text2 }]}>@{item.user?.username || '—'}</Text>
              <Pressable onPress={onLike} style={styles.statBtn} disabled={!signedIn}>
                <Ionicons name={item.is_liked ? 'heart' : 'heart-outline'} size={18} color={item.is_liked ? '#DC2626' : C.text2} />
                <Text style={{ color: item.is_liked ? '#DC2626' : C.text2, fontWeight: '700', fontSize: 13 }}>
                  {item.likes_count ?? 0} {t('museum.like')}
                </Text>
              </Pressable>
            </View>

            <View style={[styles.divider, { backgroundColor: C.line }]} />
            <Text style={[styles.commentsTitle, { color: C.text }]}>
              {t('museum.comments')} ({item.comments_count ?? 0})
            </Text>
            {commentsLoading ? (
              <Text style={[styles.meta, { color: C.text2 }]}>{t('common.loading')}</Text>
            ) : comments.length === 0 ? (
              <Text style={[styles.meta, { color: C.text2 }]}>{t('museum.noComments')}</Text>
            ) : (
              comments.map((c) => (
                <Text key={c.id} style={[styles.comment, { color: C.text }]}>
                  <Text style={{ fontWeight: '800', color: C.brownDk }}>@{c.user?.username}</Text> {c.content}
                </Text>
              ))
            )}

            {signedIn ? (
              <View style={styles.commentRow}>
                <TextInput
                  value={commentText}
                  onChangeText={onChangeComment}
                  placeholder={t('museum.commentPlaceholder')}
                  placeholderTextColor={C.text2}
                  style={[styles.commentInput, { backgroundColor: C.white, borderColor: C.line, color: C.text }]}
                />
                <Pressable onPress={onPost} style={[styles.postBtn, { backgroundColor: C.brownDk }]}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{t('museum.post')}</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.meta, { color: C.text2, marginTop: 10 }]}>{t('museum.signInToInteract')}</Text>
            )}
            {commentError ? <Text style={styles.error}>{commentError}</Text> : null}

            <Pressable onPress={onClose} style={[styles.modalBtn, { backgroundColor: C.card2, marginTop: 14 }]}>
              <Text style={{ color: C.text, fontWeight: '700', textAlign: 'center' }}>{t('common.close')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  value,
  onChange,
  placeholder,
  C,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  C: MuseumPalette;
  multiline?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={C.text2}
      multiline={multiline}
      style={[
        styles.input,
        multiline && styles.multi,
        { backgroundColor: C.white, borderColor: C.line, color: C.text },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hint: { fontSize: 13 },
  chips: { gap: 8, paddingBottom: 10, paddingTop: 4 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipCompact: { paddingHorizontal: 12, paddingVertical: 6 },
  grid: { gap: 12 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cover: { width: '100%', height: 128 },
  cardBody: { padding: 14 },
  badge: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '800',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  cardDesc: { fontSize: 13, lineHeight: 19 },
  lesson: { fontSize: 12, fontStyle: 'italic', marginTop: 10 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  meta: { fontSize: 12 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { borderRadius: 22, padding: 28, alignItems: 'center', gap: 10 },
  emptyEmoji: { fontSize: 36 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  retry: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginTop: 4 },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  modalRoot: { flex: 1, justifyContent: 'center', padding: 16 },
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  multi: { minHeight: 72, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: '#DC2626', fontSize: 13, marginBottom: 8 },
  detailCover: { width: '100%', height: 160, borderRadius: 14, marginBottom: 12 },
  detailTitle: { fontSize: 18, fontWeight: '800', marginTop: 8, marginBottom: 6 },
  detailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 4,
  },
  divider: { height: 1, marginVertical: 14 },
  commentsTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  comment: { fontSize: 13, lineHeight: 20, marginBottom: 6 },
  commentRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  postBtn: { borderRadius: 14, paddingHorizontal: 14, justifyContent: 'center' },
});
