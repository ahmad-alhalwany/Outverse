import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { WorldPrimaryButton } from '@/components/world/WorldChrome';
import {
  FORGE_GENRES,
  displayForgeOwner,
  forgeProgress,
  useForgePalette,
  type ForgeStory,
} from '@/lib/forge';

function CoverArt({ story, height }: { story: ForgeStory; height: number }) {
  const { isDark } = useTheme();
  const C = useForgePalette(isDark);
  const cover = mediaUrl(story.cover_preview || story.cover_url || '');
  const initial = (story.title || '?').trim().charAt(0).toUpperCase();
  if (cover) {
    return <Image source={{ uri: cover }} style={[styles.coverImg, { height }]} />;
  }
  return (
    <LinearGradient colors={[C.coverFrom, C.coverTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.coverFallback, { height }]}>
      <Ionicons name="book" size={22} color={C.brown} />
      <Text style={[styles.coverLetter, { color: C.brown }]}>{initial}</Text>
    </LinearGradient>
  );
}

function ProgressMeta({ story }: { story: ForgeStory }) {
  const { isDark } = useTheme();
  const { t } = useLocale();
  const C = useForgePalette(isDark);
  const pct = forgeProgress(story);
  return (
    <View>
      <View style={[styles.barTrack, { backgroundColor: C.progressBg }]}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: C.brown }]} />
      </View>
      <View style={styles.metaRow}>
        <Text style={[styles.meta, { color: C.text2 }]}>
          {story.segment_count}/{story.max_segments} {t('forge.parts')}
        </Text>
        <View style={styles.metaIcon}>
          <Ionicons name="people-outline" size={13} color={C.text2} />
          <Text style={[styles.meta, { color: C.text2 }]}>
            {story.contributors_count} {t('forge.activeSuffix')}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function ForgeStoryCard({
  story,
  onOpen,
  onEdit,
  onDelete,
}: {
  story: ForgeStory;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { isDark } = useTheme();
  const { t, isRTL } = useLocale();
  const { user } = useAuth();
  const C = useForgePalette(isDark);
  const canManage = !!(user && story.owner?.id && String(user.id) === String(story.owner.id));
  const pct = forgeProgress(story);
  const genreKey = FORGE_GENRES.find((g) => g.key === story.genre);
  const lead = displayForgeOwner(story.owner);
  const avatar = mediaUrl(story.owner?.avatar || '');

  return (
    <View style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}>
      <Pressable onPress={onOpen} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
        <CoverArt story={story} height={160} />
        <View style={styles.body}>
          <View style={[styles.chipRow, isRTL && styles.rowReverse]}>
            <Text style={[styles.chip, { backgroundColor: C.card2, color: C.brown }]}>
              {genreKey ? t(genreKey.labelKey) : story.genre_display || story.genre}
            </Text>
            <Text
              style={[
                styles.chip,
                {
                  backgroundColor: story.status === 'completed' ? C.fundedBg : C.card,
                  color: story.status === 'completed' ? C.fundedText : C.brownDk,
                },
              ]}
            >
              {story.status === 'completed' ? t('forge.completed') : t('forge.open')}
            </Text>
          </View>
          <View style={[styles.titleRow, isRTL && styles.rowReverse]}>
            <Text style={[styles.cardTitle, { color: C.text }]} numberOfLines={2}>
              {story.title || t('forge.untitled')}
            </Text>
            <Text style={[styles.pct, { color: C.brown }]}>{pct}%</Text>
          </View>
          {story.premise ? (
            <Text style={[styles.premise, { color: C.text2 }]} numberOfLines={3}>
              {story.premise}
            </Text>
          ) : null}
          <View style={{ marginTop: 14 }}>
            <ProgressMeta story={story} />
          </View>
          <View style={[styles.lead, { backgroundColor: C.card2 }, isRTL && styles.rowReverse]}>
            <Text style={[styles.leadLabel, { color: C.text2 }]}>{t('forge.lead')}</Text>
            <View style={[styles.leadWho, isRTL && styles.rowReverse]}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.leadAvatar} />
              ) : (
                <View style={[styles.leadAvatar, { backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: C.brown, fontFamily: 'Inter_700Bold', fontSize: 10 }}>{lead.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <Text style={[styles.leadName, { color: C.text }]} numberOfLines={1}>
                {lead}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
      {canManage && (onEdit || onDelete) ? (
        <View style={[styles.manageRow, isRTL && styles.rowReverse]}>
          {onEdit ? (
            <Pressable onPress={onEdit} style={[styles.manageBtn, { borderColor: C.line, backgroundColor: C.card2 }]}>
              <Ionicons name="create-outline" size={16} color={C.brownDk} />
              <Text style={{ color: C.brownDk, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{t('common.edit')}</Text>
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable onPress={onDelete} style={[styles.manageBtn, { backgroundColor: C.brownDk, borderColor: C.brownDk }]}>
              <Ionicons name="trash-outline" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{t('common.delete')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function ForgeSpotlightCard({ story, onOpen }: { story: ForgeStory; onOpen: () => void }) {
  const { isDark } = useTheme();
  const { t, isRTL } = useLocale();
  const C = useForgePalette(isDark);
  const pct = forgeProgress(story);
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, { backgroundColor: C.white, borderColor: C.line, opacity: pressed ? 0.92 : 1 }]}>
      <View style={styles.spotPad}>
        <Text style={[styles.spotLabel, { color: C.text2 }]}>{t('forge.spotlight')}</Text>
      </View>
      <CoverArt story={story} height={168} />
      <View style={styles.body}>
        <View style={[styles.titleRow, isRTL && styles.rowReverse]}>
          <Text style={[styles.spotTitle, { color: C.text }]} numberOfLines={2}>{story.title}</Text>
          <View style={[styles.pctPill, { backgroundColor: C.card2 }]}>
            <Text style={[styles.pct, { color: C.brown }]}>{pct}%</Text>
          </View>
        </View>
        {story.premise ? (
          <Text style={[styles.premise, { color: C.text2 }]} numberOfLines={2}>{story.premise}</Text>
        ) : null}
        <View style={[styles.metaRow, { marginTop: 12 }]}>
          <View style={styles.metaIcon}>
            <Ionicons name="people-outline" size={14} color={C.text2} />
            <Text style={[styles.meta, { color: C.text2 }]}>{story.contributors_count} {t('forge.activeSuffix')}</Text>
          </View>
          <Text style={[styles.meta, { color: C.text2 }]} numberOfLines={1}>
            {displayForgeOwner(story.owner)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function ForgeFeaturedCard({ story, onOpen }: { story: ForgeStory; onOpen: () => void }) {
  const { isDark } = useTheme();
  const { t, isRTL } = useLocale();
  const C = useForgePalette(isDark);
  const pct = forgeProgress(story);
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.featCard, { backgroundColor: C.white, borderColor: C.line, opacity: pressed ? 0.92 : 1 }]}>
      <CoverArt story={story} height={128} />
      <View style={styles.featBody}>
        <View style={[styles.titleRow, isRTL && styles.rowReverse]}>
          <Text style={[styles.featTitle, { color: C.text }]} numberOfLines={1}>{story.title}</Text>
          <Text style={[styles.pct, { color: C.brown, fontSize: 12 }]}>{pct}%</Text>
        </View>
        {story.premise ? (
          <Text style={[styles.featPremise, { color: C.text2 }]} numberOfLines={2}>{story.premise}</Text>
        ) : null}
        <ProgressMeta story={story} />
      </View>
    </Pressable>
  );
}

export function ForgeCreateModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (id?: number) => void;
}) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const [title, setTitle] = useState('');
  const [premise, setPremise] = useState('');
  const [genre, setGenre] = useState('fantasy');
  const [coverUrl, setCoverUrl] = useState('');
  const [maxSegments, setMaxSegments] = useState('12');
  const [visibility, setVisibility] = useState<'public' | 'invite_only'>('public');
  const [requireApproval, setRequireApproval] = useState(false);
  const [tone, setTone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!title.trim() || !premise.trim()) {
      setError(t('forge.titleRequired'));
      return;
    }
    setError('');
    setSaving(true);
    try {
      const created = await api.createForgeStory({
        title: title.trim(),
        premise: premise.trim(),
        genre,
        cover_url: coverUrl.trim(),
        max_segments: parseInt(maxSegments, 10) || 12,
        visibility,
        require_approval: requireApproval || visibility === 'invite_only',
        tone: tone.trim(),
        studio_mode: visibility === 'invite_only' ? 'collab' : 'solo',
      });
      onCreated(created?.id);
      onClose();
      setTitle('');
      setPremise('');
    } catch {
      setError(t('forge.couldNotStart'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
          <View style={styles.modalHead}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('forge.startNewStory')}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.icon} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('forge.titleLabel')}</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder={t('forge.titlePlaceholder')} placeholderTextColor={colors.textMuted} style={[styles.field, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('forge.openingLine')}</Text>
            <TextInput value={premise} onChangeText={setPremise} placeholder={t('forge.openingLinePlaceholder')} placeholderTextColor={colors.textMuted} multiline style={[styles.field, styles.area, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('forge.genreLabel')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
              {FORGE_GENRES.filter((g) => g.key !== 'all').map((g) => (
                <Pressable
                  key={g.key}
                  onPress={() => setGenre(g.key)}
                  style={[styles.chipBtn, { backgroundColor: genre === g.key ? colors.story : colors.surface, borderColor: colors.border }]}
                >
                  <Text style={{ color: genre === g.key ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>{t(g.labelKey)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('forge.maxPartsLabel')}</Text>
            <TextInput value={maxSegments} onChangeText={(v) => setMaxSegments(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder={t('forge.maxPartsPlaceholder')} placeholderTextColor={colors.textMuted} style={[styles.field, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('forge.toneLabel')}</Text>
            <TextInput value={tone} onChangeText={setTone} placeholder={t('forge.tonePlaceholder')} placeholderTextColor={colors.textMuted} style={[styles.field, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('forge.visibilityLabel')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              {(['public', 'invite_only'] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setVisibility(v)}
                  style={[styles.chipBtn, { backgroundColor: visibility === v ? colors.story : colors.surface, borderColor: colors.border }]}
                >
                  <Text style={{ color: visibility === v ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>
                    {v === 'public' ? t('forge.visibilityPublic') : t('forge.visibilityInviteOnly')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.switchRow}>
              <Text style={{ color: colors.textSecondary, flex: 1 }}>{t('forge.requireApproval')}</Text>
              <Switch value={requireApproval} onValueChange={setRequireApproval} />
            </View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('forge.coverImageUrl')}</Text>
            <TextInput value={coverUrl} onChangeText={setCoverUrl} placeholder={t('forge.coverImageUrlPlaceholder')} placeholderTextColor={colors.textMuted} autoCapitalize="none" style={[styles.field, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <WorldPrimaryButton
              label={saving ? t('forge.forging') : t('forge.forgeTheStory')}
              tone="story"
              onPress={() => void submit()}
              loading={saving}
              disabled={saving}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function ForgeEditModal({
  story,
  onClose,
  onSaved,
}: {
  story: ForgeStory;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const [title, setTitle] = useState(story.title);
  const [premise, setPremise] = useState(story.premise);
  const [maxSegments, setMaxSegments] = useState(String(story.max_segments || 12));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.updateForgeStory(story.id, {
        title: title.trim(),
        premise: premise.trim(),
        max_segments: parseInt(maxSegments, 10) || 12,
      });
      onSaved();
    } catch {
      setError(t('forge.couldNotUpdate'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
          <View style={styles.modalHead}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('forge.editStory')}</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.icon} /></Pressable>
          </View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('forge.titleLabel')}</Text>
          <TextInput value={title} onChangeText={setTitle} style={[styles.field, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('forge.descriptionLabel')}</Text>
          <TextInput value={premise} onChangeText={setPremise} multiline style={[styles.field, styles.area, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('forge.maxPartsLabel')}</Text>
          <TextInput value={maxSegments} onChangeText={(v) => setMaxSegments(v.replace(/\D/g, ''))} keyboardType="number-pad" style={[styles.field, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <WorldPrimaryButton label={saving ? t('forge.saving') : t('forge.saveChanges')} tone="story" onPress={() => void submit()} loading={saving} />
        </View>
      </View>
    </Modal>
  );
}

export function ForgeDeleteDialog({
  story,
  onClose,
  onDeleted,
}: {
  story: ForgeStory;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{t('forge.deleteStoryTitle')}</Text>
          <Text style={{ color: colors.textSecondary, marginVertical: 12 }}>{t('forge.deleteStoryBody', { title: story.title })}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={onClose} style={[styles.manageBtn, { flex: 1, borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                setBusy(true);
                try {
                  await api.deleteForgeStory(story.id);
                  onDeleted();
                } catch {
                  setBusy(false);
                }
              }}
              style={[styles.manageBtn, { flex: 1, borderColor: '#F472B6', backgroundColor: 'rgba(244,114,182,0.12)' }]}
            >
              {busy ? <ActivityIndicator color="#F472B6" /> : <Text style={{ color: '#F472B6', fontWeight: '800' }}>{t('common.delete')}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 4,
  },
  coverImg: { width: '100%' },
  coverFallback: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: 6 },
  coverLetter: { fontWeight: '700', fontSize: 28, letterSpacing: 1 },
  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  chipBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowReverse: { flexDirection: 'row-reverse' },
  cardTitle: { flex: 1, minWidth: 0, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  spotTitle: { flex: 1, minWidth: 0, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  featTitle: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  pct: { fontWeight: '600', fontSize: 14, lineHeight: 20 },
  pctPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  premise: { marginTop: 8, fontSize: 14, lineHeight: 21, fontWeight: '400' },
  featPremise: { marginTop: 6, marginBottom: 10, fontSize: 13, lineHeight: 19, fontWeight: '400' },
  barTrack: { height: 10, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8 },
  meta: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  metaIcon: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lead: {
    marginTop: 14,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  leadLabel: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  leadWho: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  leadAvatar: { width: 22, height: 22, borderRadius: 11 },
  leadName: { fontSize: 13, lineHeight: 16, fontWeight: '600', maxWidth: 160 },
  spotPad: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  spotLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  featCard: { width: 252, borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  featBody: { padding: 14 },
  manageRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  manageBtn: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10,8,24,0.65)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  field: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 15 },
  area: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  error: { color: '#F472B6', marginBottom: 10, fontWeight: '600' },
});
