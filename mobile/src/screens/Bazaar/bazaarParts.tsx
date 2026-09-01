import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import {
  BAZAAR_CATEGORIES,
  bazaarCategoryLabel,
  bazaarOwnerName,
  formatIdeaTargetDate,
  fundingPercent,
  type BazaarIdea,
  type BazaarIdeaUser,
} from '@/lib/bazaar';
import type { AppLocale } from '@/i18n';

export type BazaarPalette = {
  cream: string;
  card: string;
  card2: string;
  white: string;
  brown: string;
  brownDk: string;
  text: string;
  text2: string;
  line: string;
  overlay: string;
  fundedBg: string;
  fundedText: string;
  progressBg: string;
};

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

function asUpload(uri: string, name: string, type?: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  const mime =
    type ||
    (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg');
  return { uri, name, type: mime } as unknown as Blob;
}

function CollaboratorAvatars({
  collaborators,
  C,
}: {
  collaborators?: BazaarIdeaUser[];
  C: BazaarPalette;
}) {
  if (!collaborators?.length) return null;
  const shown = collaborators.slice(0, 3);
  return (
    <View style={styles.avatars}>
      {shown.map((user, index) => {
        const src = user.avatar ? mediaUrl(user.avatar) : '';
        return src ? (
          <Image
            key={`${user.id || user.username}-${index}`}
            source={{ uri: src }}
            style={[styles.miniAvatar, { borderColor: C.white, marginLeft: index ? -8 : 0 }]}
          />
        ) : (
          <View
            key={`${user.id || user.username}-${index}`}
            style={[styles.miniAvatar, { backgroundColor: C.card, borderColor: C.white, marginLeft: index ? -8 : 0 }]}
          />
        );
      })}
      {collaborators.length > 3 ? (
        <Text style={{ color: C.text2, fontSize: 11, marginLeft: 4 }}>+{collaborators.length - 3}</Text>
      ) : null}
    </View>
  );
}

export function FeaturedHero({
  idea,
  C,
  t,
  locale,
  onOpen,
}: {
  idea: BazaarIdea;
  C: BazaarPalette;
  t: TFn;
  locale: AppLocale;
  onOpen: () => void;
}) {
  const cover = idea.cover_url ? mediaUrl(idea.cover_url) : '';
  const due = formatIdeaTargetDate(idea.target_date, locale);
  return (
    <Pressable onPress={onOpen} style={[styles.hero, { backgroundColor: C.white, borderColor: C.line }]}>
      {cover ? (
        <Image source={{ uri: cover }} style={styles.heroCover} resizeMode="cover" />
      ) : (
        <LinearGradient colors={[C.brown, C.brownDk]} style={styles.heroCover} />
      )}
      <View style={styles.heroBody}>
        <Text style={[styles.kicker, { color: C.brown }]}>{t('bazaar.featured')}</Text>
        <Text style={[styles.heroTitle, { color: C.text }]} numberOfLines={2}>
          {idea.title}
        </Text>
        {idea.description ? (
          <Text style={[styles.heroDesc, { color: C.text2 }]} numberOfLines={2}>
            {idea.description}
          </Text>
        ) : null}
        <View style={styles.heroMeta}>
          <Text style={{ color: C.text2, fontSize: 12 }}>
            {idea.supporters ?? 0} {t('bazaar.supporters')}
          </Text>
          {due ? (
            <View style={styles.dueRow}>
              <Ionicons name="calendar-outline" size={13} color={C.brownDk} />
              <Text style={{ color: C.brownDk, fontSize: 12 }}>{t('bazaar.dueBy', { date: due })}</Text>
            </View>
          ) : null}
          <CollaboratorAvatars collaborators={idea.collaborators} C={C} />
        </View>
        <Text style={{ color: C.brown, fontWeight: '700', fontSize: 13, marginTop: 10 }}>
          {t('bazaar.featuredHeroCta')} →
        </Text>
      </View>
    </Pressable>
  );
}

export function IdeaCard({
  idea,
  view,
  C,
  t,
  locale,
  canManage,
  onOpen,
  onVote,
  onSave,
  onEdit,
  onDelete,
  onPledge,
}: {
  idea: BazaarIdea;
  view: 'grid' | 'list';
  C: BazaarPalette;
  t: TFn;
  locale: AppLocale;
  canManage: boolean;
  onOpen: () => void;
  onVote: () => void;
  onSave: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPledge: () => void;
}) {
  const cover = idea.cover_url ? mediaUrl(idea.cover_url) : '';
  const due = formatIdeaTargetDate(idea.target_date, locale);
  const pct = fundingPercent(idea);
  const isList = view === 'list';
  const owner = bazaarOwnerName(idea, t('bazaar.anonymousOwner'));
  const initial = (owner[0] || '?').toUpperCase();

  const coverNode = (
    <Pressable onPress={onOpen} style={isList ? styles.coverListWrap : styles.coverWrap}>
      {cover ? (
        <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient colors={[C.card, C.card2]} style={StyleSheet.absoluteFill} />
      )}
    </Pressable>
  );

  return (
    <View style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}>
      <View style={isList ? styles.cardMainList : styles.cardMainGrid}>
        {coverNode}
        <View style={styles.cardBody}>
          <Pressable onPress={onOpen}>
            <View style={styles.chipRow}>
              {idea.category ? (
                <View style={[styles.chip, { backgroundColor: C.card2 }]}>
                  <Text style={[styles.chipText, { color: C.brown }]}>{bazaarCategoryLabel(idea.category, locale)}</Text>
                </View>
              ) : null}
              {idea.collab_project_id ? (
                <View style={[styles.chip, { backgroundColor: C.fundedBg }]}>
                  <Text style={[styles.chipText, { color: C.fundedText }]}>{t('bazaar.collabActive')}</Text>
                </View>
              ) : null}
              {idea.status && idea.status !== 'proposed' ? (
                <View style={[styles.chip, { backgroundColor: C.fundedBg }]}>
                  <Text style={[styles.chipText, { color: C.fundedText }]}>
                    {idea.status === 'in_progress' ? t('bazaar.inProgress') : t('bazaar.completed')}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.cardTitle, { color: C.text }]} numberOfLines={2}>
              {idea.title}
            </Text>
            {idea.description ? (
              <Text style={[styles.cardDesc, { color: C.text2 }]} numberOfLines={isList ? 2 : 3}>
                {idea.description}
              </Text>
            ) : null}
            {due ? (
              <View style={[styles.dueRow, { marginTop: 8 }]}>
                <Ionicons name="calendar-outline" size={13} color={C.brownDk} />
                <Text style={{ color: C.brownDk, fontSize: 12 }}>{t('bazaar.dueBy', { date: due })}</Text>
              </View>
            ) : null}
          </Pressable>

          {pct != null ? (
            <View style={styles.fundBlock}>
              <View style={[styles.track, { backgroundColor: C.progressBg }]}>
                <View style={[styles.fill, { width: `${pct}%`, backgroundColor: C.brown }]} />
              </View>
              <Text style={{ color: C.text2, fontSize: 11 }}>
                ${Number(idea.funding_raised || 0).toLocaleString()} {t('bazaar.raised')} · $
                {Number(idea.funding_goal || 0).toLocaleString()} {t('bazaar.goal')}
              </Text>
              {!idea.is_owner ? (
                <Pressable onPress={onPledge} style={[styles.pledgeBtn, { backgroundColor: C.brown }]}>
                  <Text style={styles.pledgeText}>{t('bazaar.pledgeCta')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {idea.tags?.length ? (
            <View style={styles.chipRow}>
              {idea.tags.slice(0, 3).map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: C.card2 }]}>
                  <Text style={{ color: C.text2, fontSize: 11 }}>#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {idea.roles_needed?.length ? (
            <View style={styles.chipRow}>
              {idea.roles_needed.slice(0, 3).map((role) => (
                <View key={role} style={[styles.tag, { backgroundColor: C.card2 }]}>
                  <Text style={{ color: C.text, fontSize: 11 }}>{role}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.ownerRow}>
          {idea.owner?.avatar ? (
            <Image source={{ uri: mediaUrl(idea.owner.avatar) }} style={styles.ownerAvatar} />
          ) : (
            <View style={[styles.ownerAvatar, { backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: C.brown, fontSize: 10, fontWeight: '800' }}>{initial}</Text>
            </View>
          )}
          <Text style={[styles.ownerName, { color: C.text2 }]} numberOfLines={1}>
            {owner}
          </Text>
          <CollaboratorAvatars collaborators={idea.collaborators} C={C} />
        </View>
        <View style={styles.actions}>
          {canManage ? (
            <>
              <Pressable onPress={onEdit} style={[styles.iconBtn, { backgroundColor: C.card2 }]} hitSlop={6}>
                <Ionicons name="create-outline" size={16} color={C.brownDk} />
              </Pressable>
              <Pressable onPress={onDelete} style={[styles.iconBtn, { backgroundColor: C.brownDk }]} hitSlop={6}>
                <Ionicons name="trash-outline" size={16} color="#fff" />
              </Pressable>
            </>
          ) : null}
          <Pressable onPress={onSave} style={[styles.iconBtn, { backgroundColor: C.card2 }]} hitSlop={6}>
            <Ionicons name={idea.is_saved ? 'bookmark' : 'bookmark-outline'} size={16} color={idea.is_saved ? C.brown : C.text2} />
          </Pressable>
          <Pressable onPress={onVote} style={styles.voteBtn} hitSlop={6}>
            <Ionicons name={idea.is_voted ? 'heart' : 'heart-outline'} size={18} color={C.brown} />
            <Text style={{ color: C.brown, fontWeight: '700', fontSize: 13 }}>{idea.supporters ?? 0}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function FeaturedRail({
  ideas,
  C,
  t,
  onOpen,
}: {
  ideas: BazaarIdea[];
  C: BazaarPalette;
  t: TFn;
  onOpen: (idea: BazaarIdea) => void;
}) {
  return (
    <View style={[styles.sideCard, { backgroundColor: C.white, borderColor: C.line }]}>
      <Text style={[styles.sideTitle, { color: C.text }]}>{t('bazaar.featured')}</Text>
      {ideas.length === 0 ? (
        <Text style={{ color: C.text2, fontSize: 13 }}>{t('bazaar.noFeatured')}</Text>
      ) : (
        ideas.map((idea) => {
          const cover = idea.cover_url ? mediaUrl(idea.cover_url) : '';
          return (
            <Pressable key={String(idea.id)} onPress={() => onOpen(idea)} style={styles.featuredRow}>
              {cover ? (
                <Image source={{ uri: cover }} style={styles.featuredThumb} />
              ) : (
                <View style={[styles.featuredThumb, { backgroundColor: C.card }]} />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
                  {idea.title}
                </Text>
                <Text style={{ color: C.text2, fontSize: 11, marginTop: 2 }}>
                  {idea.supporters ?? 0} {t('bazaar.supporters')}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  C,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  C: BazaarPalette;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: C.text2 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.text2}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          { color: C.text, backgroundColor: C.white, borderColor: C.line },
          multiline && { minHeight: 88 },
        ]}
      />
    </View>
  );
}

export function CreateIdeaModal({
  visible,
  C,
  t,
  locale,
  onClose,
  onCreated,
}: {
  visible: boolean;
  C: BazaarPalette;
  t: TFn;
  locale: AppLocale;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('technology');
  const [goal, setGoal] = useState('');
  const [roles, setRoles] = useState('');
  const [tags, setTags] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [coverUri, setCoverUri] = useState('');
  const [coverName, setCoverName] = useState('');
  const [coverType, setCoverType] = useState('');
  const [milestones, setMilestones] = useState<string[]>([]);
  const [coach, setCoach] = useState<{ title?: string; milestones?: string[]; constellation_questions?: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [coaching, setCoaching] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setTitle('');
    setDescription('');
    setCategory('technology');
    setGoal('');
    setRoles('');
    setTags('');
    setTargetDate('');
    setCoverUri('');
    setCoverName('');
    setCoverType('');
    setMilestones([]);
    setCoach(null);
    setError('');
  };

  const pickCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if ((asset.fileSize || 0) > 5 * 1024 * 1024) {
      setError(t('bazaar.imageTooLarge'));
      return;
    }
    setCoverUri(asset.uri);
    setCoverName(asset.fileName || `cover-${Date.now()}.jpg`);
    setCoverType(asset.mimeType || 'image/jpeg');
    setError('');
  };

  const runCoach = async () => {
    if (!title.trim() && !description.trim()) return;
    setCoaching(true);
    setError('');
    try {
      const result = await api.coachIdea({ title: title.trim(), description: description.trim(), lang: locale });
      if (result.error) {
        setError(result.error);
        return;
      }
      setCoach(result);
      if (!title.trim() && result.title) setTitle(result.title);
      if (result.milestones?.length) setMilestones(result.milestones);
    } catch {
      setError(t('bazaar.createFailed'));
    } finally {
      setCoaching(false);
    }
  };

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      setError(t('bazaar.requiredFields'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('description', description.trim());
      form.append('category', category);
      if (goal) form.append('funding_goal', goal);
      form.append(
        'roles_needed',
        JSON.stringify(roles ? roles.split(',').map((r) => r.trim()).filter(Boolean) : []),
      );
      form.append('tags', JSON.stringify(tags ? tags.split(',').map((r) => r.trim()).filter(Boolean) : []));
      if (targetDate.trim()) form.append('target_date', targetDate.trim());
      if (milestones.length) {
        form.append('milestones', JSON.stringify(milestones.map((item) => ({ title: item }))));
      }
      if (coverUri) form.append('cover_image', asUpload(coverUri, coverName || 'cover.jpg', coverType));
      await api.createIdea(form);
      reset();
      onCreated();
      onClose();
    } catch (err: any) {
      const data = err?.response?.data;
      setError(
        (typeof data?.cover_image?.[0] === 'string' && data.cover_image[0]) ||
          (typeof data?.detail === 'string' && data.detail) ||
          t('bazaar.createFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
        <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: C.cream, borderColor: C.line }]}>
          <Pressable onPress={onClose} style={[styles.close, { backgroundColor: C.card }]}>
            <Text style={{ color: C.text, fontSize: 20 }}>×</Text>
          </Pressable>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={[styles.modalTitle, { color: C.text }]}>{t('bazaar.createModalTitle')}</Text>
            <Field label={t('bazaar.fieldTitle')} value={title} onChange={setTitle} C={C} placeholder={t('bazaar.titlePlaceholder')} />
            <Field
              label={t('bazaar.fieldDescription')}
              value={description}
              onChange={setDescription}
              C={C}
              placeholder={t('bazaar.descPlaceholder')}
              multiline
            />
            <Pressable
              onPress={() => void runCoach()}
              disabled={coaching || (!title.trim() && !description.trim())}
              style={[styles.coachBtn, { backgroundColor: C.brownDk, opacity: coaching ? 0.6 : 1 }]}
            >
              <Text style={styles.coachText}>{coaching ? t('bazaar.coaching') : t('bazaar.ideaCoach')}</Text>
            </Pressable>
            {coach && !coach.title && !coach.milestones?.length ? null : coach ? (
              <View style={[styles.coachBox, { backgroundColor: C.card2, borderColor: C.line }]}>
                {coach.title && coach.title !== title ? (
                  <Pressable onPress={() => setTitle(coach.title || '')}>
                    <Text style={{ color: C.text, fontSize: 12 }}>
                      {t('bazaar.suggestedTitle')} <Text style={{ color: C.brown, fontWeight: '700' }}>{coach.title}</Text>
                    </Text>
                  </Pressable>
                ) : null}
                {coach.milestones?.length ? (
                  <Text style={{ color: C.text2, fontSize: 12, marginTop: 6 }}>
                    {t('bazaar.milestonesApplied', { n: coach.milestones.length })}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Text style={[styles.label, { color: C.text2 }]}>{t('bazaar.fieldCategory')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
              {BAZAAR_CATEGORIES.filter((c) => c.key !== 'all').map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => setCategory(item.key)}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: category === item.key ? C.brown : C.white,
                      borderColor: category === item.key ? C.brown : C.line,
                    },
                  ]}
                >
                  <Text style={{ color: category === item.key ? '#fff' : C.text2, fontWeight: '600', fontSize: 13 }}>
                    {locale === 'ar' ? item.ar : item.en}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Field label={t('bazaar.fieldFundingGoal')} value={goal} onChange={(v) => setGoal(v.replace(/\D/g, ''))} C={C} placeholder={t('common.optional')} />
            <Text style={[styles.label, { color: C.text2 }]}>{t('bazaar.fieldCoverImage')}</Text>
            <Pressable onPress={() => void pickCover()} style={[styles.coverPick, { borderColor: C.line, backgroundColor: C.white }]}>
              {coverUri ? (
                <Image source={{ uri: coverUri }} style={styles.coverPreview} />
              ) : (
                <View style={styles.coverEmpty}>
                  <Text style={{ color: C.brown, fontWeight: '700' }}>{t('bazaar.uploadImage')}</Text>
                  <Text style={{ color: C.text2, fontSize: 12, marginTop: 4 }}>{t('bazaar.imageHint')}</Text>
                </View>
              )}
            </Pressable>
            {coverUri ? (
              <Pressable onPress={() => setCoverUri('')} style={{ marginBottom: 12 }}>
                <Text style={{ color: C.brown, fontWeight: '700' }}>{t('bazaar.removeImage')}</Text>
              </Pressable>
            ) : null}
            <Field label={t('bazaar.fieldRolesNeeded')} value={roles} onChange={setRoles} C={C} placeholder={t('bazaar.rolesPlaceholder')} />
            <Field label={t('bazaar.tagsLabel')} value={tags} onChange={setTags} C={C} placeholder={t('bazaar.tagsHint')} />
            <Field label={t('bazaar.targetDateLabel')} value={targetDate} onChange={setTargetDate} C={C} placeholder="YYYY-MM-DD" />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable onPress={() => void submit()} disabled={saving} style={[styles.submit, { backgroundColor: C.brownDk, opacity: saving ? 0.65 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('bazaar.plantIdea')}</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function EditIdeaModal({
  idea,
  C,
  t,
  locale,
  onClose,
  onSaved,
}: {
  idea: BazaarIdea;
  C: BazaarPalette;
  t: TFn;
  locale: AppLocale;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(idea.title);
  const [description, setDescription] = useState(idea.description || '');
  const [category, setCategory] = useState(idea.category || 'technology');
  const [roles, setRoles] = useState((idea.roles_needed || []).join(', '));
  const [tags, setTags] = useState((idea.tags || []).join(', '));
  const [targetDate, setTargetDate] = useState(idea.target_date || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.updateIdea(idea.id, {
        title: title.trim(),
        description: description.trim(),
        category,
        roles_needed: roles.split(',').map((r) => r.trim()).filter(Boolean),
        tags: tags.split(',').map((r) => r.trim()).filter(Boolean),
        target_date: targetDate.trim() || null,
      });
      onSaved();
    } catch {
      setError(t('bazaar.updateIdeaFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
        <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: C.cream, borderColor: C.line }]}>
          <Pressable onPress={onClose} style={[styles.close, { backgroundColor: C.card }]}>
            <Text style={{ color: C.text, fontSize: 20 }}>×</Text>
          </Pressable>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalTitle, { color: C.text }]}>{t('bazaar.editIdea')}</Text>
            <Field label={t('bazaar.fieldTitle')} value={title} onChange={setTitle} C={C} />
            <Field label={t('bazaar.fieldDescription')} value={description} onChange={setDescription} C={C} multiline />
            <Text style={[styles.label, { color: C.text2 }]}>{t('bazaar.fieldCategory')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
              {BAZAAR_CATEGORIES.filter((c) => c.key !== 'all').map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => setCategory(item.key)}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: category === item.key ? C.brown : C.white,
                      borderColor: category === item.key ? C.brown : C.line,
                    },
                  ]}
                >
                  <Text style={{ color: category === item.key ? '#fff' : C.text2, fontWeight: '600', fontSize: 13 }}>
                    {locale === 'ar' ? item.ar : item.en}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Field label={t('bazaar.fieldRolesNeeded')} value={roles} onChange={setRoles} C={C} />
            <Field label={t('bazaar.tagsLabel')} value={tags} onChange={setTags} C={C} placeholder={t('bazaar.tagsHint')} />
            <Field label={t('bazaar.targetDateLabel')} value={targetDate} onChange={setTargetDate} C={C} placeholder="YYYY-MM-DD" />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable onPress={() => void submit()} disabled={saving} style={[styles.submit, { backgroundColor: C.brownDk, opacity: saving ? 0.65 : 1 }]}>
              <Text style={styles.submitText}>{saving ? t('bazaar.savingIdea') : t('bazaar.saveIdea')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function DeleteIdeaDialog({
  idea,
  C,
  t,
  onClose,
  onDeleted,
}: {
  idea: BazaarIdea;
  C: BazaarPalette;
  t: TFn;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await api.deleteIdea(idea.id);
      onDeleted();
    } catch {
      Alert.alert(t('bazaar.deleteIdea'), t('bazaar.deleteIdeaFailed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={onClose} />
        <View style={[styles.confirm, { backgroundColor: C.cream, borderColor: C.line }]}>
          <Text style={[styles.modalTitle, { color: C.text }]}>{t('bazaar.deleteIdea')}</Text>
          <Text style={{ color: C.text2, marginBottom: 16 }}>{t('bazaar.confirmDeleteIdea')}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={onClose} style={[styles.halfBtn, { backgroundColor: C.card2 }]}>
              <Text style={{ color: C.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable onPress={() => void confirm()} disabled={busy} style={[styles.halfBtn, { backgroundColor: C.brownDk }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{busy ? t('bazaar.deletingIdea') : t('bazaar.deleteIdea')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function PledgeSheet({
  idea,
  C,
  t,
  onClose,
  onPledged,
}: {
  idea: BazaarIdea;
  C: BazaarPalette;
  t: TFn;
  onClose: () => void;
  onPledged: (funding_raised: number) => void;
}) {
  const [amount, setAmount] = useState('50');
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    const value = parseInt(amount, 10);
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('bazaar.pledgeInvalid'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await api.pledgeIdea(idea.id, value, anonymous);
      onPledged(data.funding_raised);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail === 'Insufficient coins.' ? t('bazaar.insufficientCoins') : detail || t('bazaar.pledgeFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
        <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={onClose} />
        <View style={[styles.confirm, { backgroundColor: C.cream, borderColor: C.line }]}>
          <Text style={[styles.modalTitle, { color: C.text }]}>{t('bazaar.pledge')}</Text>
          <Text style={{ color: C.text2, marginBottom: 12 }}>{t('bazaar.pledgeConfirm')}</Text>
          <Text style={[styles.label, { color: C.text2 }]}>{t('bazaar.pledgeAmount')}</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            style={[styles.input, { color: C.text, backgroundColor: C.white, borderColor: C.line }]}
          />
          <Pressable onPress={() => setAnonymous((v) => !v)} style={styles.anonRow}>
            <Ionicons name={anonymous ? 'checkbox' : 'square-outline'} size={20} color={C.brown} />
            <Text style={{ color: C.text, flex: 1 }}>{t('bazaar.pledgeAnonymous')}</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Pressable onPress={onClose} style={[styles.halfBtn, { backgroundColor: C.card2 }]}>
              <Text style={{ color: C.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable onPress={() => void confirm()} disabled={busy} style={[styles.halfBtn, { backgroundColor: C.brown, opacity: busy ? 0.65 : 1 }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{busy ? t('bazaar.pledging') : t('bazaar.pledge')}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, marginBottom: 16 },
  heroCover: { width: '100%', height: 168 },
  heroBody: { padding: 16 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { fontSize: 20, fontWeight: '800', marginTop: 6 },
  heroDesc: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  card: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, marginBottom: 14 },
  cardMainList: { flexDirection: 'row', alignItems: 'stretch' },
  cardMainGrid: { flexDirection: 'column' },
  coverWrap: { width: '100%', height: 148 },
  coverListWrap: { width: 118, minHeight: 176 },
  cardBody: { padding: 14, flex: 1, minWidth: 0 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: '700' },
  cardTitle: { fontSize: 16, fontWeight: '800', lineHeight: 22 },
  cardDesc: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  fundBlock: { marginTop: 10, gap: 8 },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  pledgeBtn: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  pledgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  tag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  cardFooter: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 2, gap: 8 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  ownerName: { flex: 1, minWidth: 0, fontSize: 12 },
  ownerAvatar: { width: 24, height: 24, borderRadius: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 6 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  sideCard: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 14 },
  sideTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  featuredRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  featuredThumb: { width: 40, height: 40, borderRadius: 10 },
  modalRoot: { flex: 1, justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: { margin: 16, maxHeight: '88%', borderRadius: 22, borderWidth: 1, padding: 18 },
  confirm: { margin: 16, borderRadius: 22, borderWidth: 1, padding: 18 },
  close: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14, paddingRight: 36 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 },
  coachBtn: { alignSelf: 'flex-end', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12 },
  coachText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  coachBox: { borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 12 },
  catChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  coverPick: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, overflow: 'hidden', marginBottom: 10, minHeight: 112 },
  coverPreview: { width: '100%', height: 140 },
  coverEmpty: { height: 112, alignItems: 'center', justifyContent: 'center', padding: 12 },
  error: { color: '#c0392b', marginBottom: 10 },
  submit: { borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  halfBtn: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  anonRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
});
