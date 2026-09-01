import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import {
  WorldBackdrop,
  WorldCard,
  WorldHeader,
  WorldHero,
  WorldPrimaryButton,
} from '@/components/world/WorldChrome';
import {
  displayForgeOwner,
  formatCharacterForDraft,
  formatOutlineForDraft,
  forgeProgress,
  type ForgeCharacter,
  type ForgeOutlineBeat,
  type ForgeSegment,
  type ForgeStory,
} from '@/lib/forge';

type BibleTab = 'outline' | 'cast' | 'world';
type BuddyKind = 'continue' | 'rewrite' | 'outline' | 'character' | 'critique' | 'spark' | 'twist' | 'sensory' | 'dialogue';

export default function ForgeDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const { t } = useLocale();
  const { user } = useAuth();
  const storyId = route.params?.storyId;
  const [story, setStory] = useState<ForgeStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState('');
  const [bibleTab, setBibleTab] = useState<BibleTab>('outline');
  const [worldNotes, setWorldNotes] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [buddyResult, setBuddyResult] = useState<{ kind: string; text?: string; outline?: ForgeOutlineBeat[]; character?: ForgeCharacter } | null>(null);
  const [dialogueDraft, setDialogueDraft] = useState<Record<number, string>>({});
  const [reviseId, setReviseId] = useState<number | null>(null);
  const [reviseText, setReviseText] = useState('');

  const load = useCallback(async () => {
    if (!storyId) return;
    setLoading(true);
    setError('');
    try {
      const data = (await api.getForgeStory(storyId)) as ForgeStory;
      setStory(data);
      setWorldNotes(data.world_notes || '');
    } catch {
      setError(t('forge.storyNotFound'));
      setStory(null);
    } finally {
      setLoading(false);
    }
  }, [storyId, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const isStudioMember = Boolean(story?.is_studio_member || story?.is_owner);
  const myInvite = useMemo(
    () => (story?.collaborators || []).find((c) => c.user?.id && String(c.user.id) === String(user?.id) && c.status === 'invited'),
    [story, user?.id],
  );
  const pendingJoins = useMemo(
    () => (story?.is_owner ? (story.collaborators || []).filter((c) => c.status === 'requested') : []),
    [story],
  );
  const approved = (story?.segments || []).filter((s) => !s.status || s.status === 'approved');
  const pending = story?.pending_segments || (story?.segments || []).filter((s) => s.status === 'pending');
  const cover = mediaUrl(story?.cover_preview || story?.cover_url || '');
  const pct = story ? forgeProgress(story) : 0;

  const toggleSave = async () => {
    if (!story) return;
    try {
      const res = await api.toggleForgeSave(story.id);
      setStory({ ...story, is_saved: Boolean(res?.saved) });
    } catch {
      Alert.alert(t('forge.title'), t('common.actionFailed'));
    }
  };

  const shareStory = async () => {
    if (!story) return;
    try {
      await Share.share({ message: `${story.title}\n${story.premise || ''}`.trim() });
    } catch {
      /* ignore */
    }
  };

  const publishPart = async () => {
    if (!story || !draft.trim()) return;
    setBusy('write');
    try {
      await api.addForgeSegment(story.id, { content: draft.trim() });
      setDraft('');
      await load();
    } catch {
      Alert.alert(t('forge.title'), t('common.actionFailed'));
    } finally {
      setBusy('');
    }
  };

  const runBuddy = async (kind: BuddyKind) => {
    if (!story) return;
    setBusy(`buddy-${kind}`);
    setBuddyResult(null);
    try {
      if (kind === 'continue') {
        const r = await api.buddyForgeContinue(story.id);
        setBuddyResult({ kind, text: r.text });
      } else if (kind === 'rewrite') {
        const r = await api.buddyForgeRewrite(story.id, draft || story.premise);
        setBuddyResult({ kind, text: r.text });
      } else if (kind === 'outline') {
        const r = await api.buddyForgeOutline(story.id, false);
        setBuddyResult({ kind, outline: r.outline || [] });
      } else if (kind === 'character') {
        const r = await api.buddyForgeCharacter(story.id, false);
        setBuddyResult({ kind, character: r.character || {} });
      } else if (kind === 'critique') {
        const r = await api.buddyForgeCritique(story.id, draft);
        setBuddyResult({ kind, text: r.text });
      } else {
        const r = await api.buddyForgeInspire(story.id, kind, draft);
        setBuddyResult({ kind, text: r.text });
      }
    } catch {
      Alert.alert(t('forge.writingBuddy'), t('common.actionFailed'));
    } finally {
      setBusy('');
    }
  };

  const insertBuddy = () => {
    if (!buddyResult) return;
    let chunk = '';
    if (buddyResult.kind === 'character' && buddyResult.character) chunk = formatCharacterForDraft(buddyResult.character);
    else if (buddyResult.kind === 'outline' && buddyResult.outline) chunk = formatOutlineForDraft(buddyResult.outline);
    else chunk = buddyResult.text || '';
    if (!chunk.trim()) return;
    setDraft((d) => (d ? `${d.trim()}\n\n${chunk}` : chunk));
  };

  const applyBuddyBible = async () => {
    if (!story?.can_edit_bible || !buddyResult) return;
    setBusy('bible-apply');
    try {
      if (buddyResult.kind === 'outline' && buddyResult.outline) {
        await api.patchForgeBible(story.id, { outline: buddyResult.outline });
        setBibleTab('outline');
      } else if (buddyResult.kind === 'character' && buddyResult.character) {
        await api.patchForgeBible(story.id, { characters: [...(story.characters || []), buddyResult.character] });
        setBibleTab('cast');
      }
      await load();
    } catch {
      Alert.alert(t('forge.storyBible'), t('common.actionFailed'));
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <WorldBackdrop tone="story">
        <SafeAreaView style={{ flex: 1 }}>
          <WorldHeader title={t('forge.title')} tone="story" onBack={() => navigation.goBack()} />
          <ActivityIndicator color={colors.story} style={{ marginTop: 48 }} />
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 12 }}>{t('forge.openingStudio')}</Text>
        </SafeAreaView>
      </WorldBackdrop>
    );
  }

  if (error || !story) {
    return (
      <WorldBackdrop tone="story">
        <SafeAreaView style={{ flex: 1 }}>
          <WorldHeader title={t('forge.title')} tone="story" onBack={() => navigation.goBack()} />
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 48 }}>{error || t('forge.storyNotFound')}</Text>
        </SafeAreaView>
      </WorldBackdrop>
    );
  }

  if (!isStudioMember) {
    return (
      <WorldBackdrop tone="story">
        <SafeAreaView style={{ flex: 1 }}>
          <WorldHeader title={t('forge.title')} subtitle={t('forge.backToForge')} tone="story" onBack={() => navigation.goBack()} />
          <ScrollView contentContainerStyle={styles.content}>
            {cover ? <Image source={{ uri: cover }} style={styles.heroCover} /> : null}
            <WorldHero
              tone="story"
              eyebrow={`${story.studio_mode === 'solo' ? t('forge.privateSoloStudio') : t('forge.collaborativeWorld')} · ${story.genre_display || story.genre}`}
              title={story.title}
              body={story.premise}
            />
            <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
              {displayForgeOwner(story.owner)} · {story.approved_segment_count ?? approved.length}/{story.max_segments} {t('forge.parts')}
            </Text>
            {approved.slice(0, 3).map((seg) => (
              <WorldCard key={seg.id}>
                <Text style={[styles.partLabel, { color: colors.story }]}>{t('forge.part')} {seg.order}</Text>
                <Text style={{ color: colors.text, lineHeight: 22 }}>{seg.content.slice(0, 420)}{seg.content.length > 420 ? '…' : ''}</Text>
              </WorldCard>
            ))}
            <WorldCard>
              {myInvite ? (
                <>
                  <Text style={[styles.blockTitle, { color: colors.text }]}>{t('forge.youAreInvited')}</Text>
                  <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>{t('forge.joinAsRoleHint', { role: myInvite.role })}</Text>
                  <WorldPrimaryButton label={t('forge.acceptOpenStudio')} tone="story" onPress={() => void api.respondForgeInvite(story.id, true).then(load)} />
                  <Pressable onPress={() => void api.respondForgeInvite(story.id, false).then(load)} style={{ marginTop: 10 }}>
                    <Text style={{ color: colors.textSecondary, textAlign: 'center', fontWeight: '700' }}>{t('forge.decline')}</Text>
                  </Pressable>
                </>
              ) : story.my_collab_status === 'requested' ? (
                <>
                  <Text style={[styles.blockTitle, { color: colors.text }]}>{t('forge.joinRequestPending')}</Text>
                  <Text style={{ color: colors.textSecondary }}>{t('forge.joinRequestPendingHint')}</Text>
                </>
              ) : story.can_request_join ? (
                <>
                  <Text style={[styles.blockTitle, { color: colors.text }]}>{t('forge.requestToJoinTitle')}</Text>
                  <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>{t('forge.requestToJoinHint')}</Text>
                  <WorldPrimaryButton
                    label={user ? t('forge.requestToJoin') : t('forge.signInToRequest')}
                    tone="story"
                    disabled={!user}
                    onPress={() => void api.requestForgeJoin(story.id).then(load).catch(() => Alert.alert(t('forge.title'), t('forge.joiningUnavailable')))}
                  />
                </>
              ) : (
                <Text style={{ color: colors.textSecondary }}>{t('forge.joiningUnavailable')}</Text>
              )}
            </WorldCard>
          </ScrollView>
        </SafeAreaView>
      </WorldBackdrop>
    );
  }

  const outline = story.outline || [];
  const characters = story.characters || [];

  return (
    <WorldBackdrop tone="story">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title={story.title}
          subtitle={story.studio_mode === 'solo' ? t('forge.soloStudio') : t('forge.collabStudio')}
          tone="story"
          onBack={() => navigation.goBack()}
          right={
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <Pressable onPress={() => void toggleSave()} hitSlop={8} style={{ padding: 6 }}>
                <Ionicons name={story.is_saved ? 'bookmark' : 'bookmark-outline'} size={20} color={colors.story} />
              </Pressable>
              <Pressable onPress={() => void shareStory()} hitSlop={8} style={{ padding: 6 }}>
                <Ionicons name="share-outline" size={20} color={colors.icon} />
              </Pressable>
            </View>
          }
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {cover ? <Image source={{ uri: cover }} style={styles.heroCover} /> : null}
          <WorldHero
            tone="story"
            eyebrow={`${story.genre_display || story.genre} · ${pct}%`}
            title={story.title}
            body={story.premise}
          />
          <Text style={{ color: colors.textSecondary }}>
            {t('forge.live')} {story.approved_segment_count ?? approved.length}/{story.max_segments} {t('forge.parts')}
            {story.word_count != null ? ` · ${story.word_count} ${t('forge.words')}` : ''}
          </Text>

          <WorldCard>
            <Text style={[styles.blockTitle, { color: colors.text }]}>{t('forge.storyBible')}</Text>
            <View style={styles.tabRow}>
              {(['outline', 'cast', 'world'] as const).map((tab) => (
                <Pressable key={tab} onPress={() => setBibleTab(tab)} style={[styles.tab, bibleTab === tab && { backgroundColor: colors.story }]}>
                  <Text style={{ color: bibleTab === tab ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>
                    {tab === 'outline' ? t('forge.bibleOutline') : tab === 'cast' ? t('forge.bibleCast') : t('forge.bibleWorld')}
                  </Text>
                </Pressable>
              ))}
            </View>
            {bibleTab === 'outline' ? (
              outline.length ? outline.map((act, i) => (
                <View key={i} style={{ marginBottom: 10 }}>
                  <Text style={{ color: colors.text, fontWeight: '800' }}>{t('forge.act')} {act.act ?? i + 1}: {act.title || t('forge.untitled')}</Text>
                  {(act.beats || []).map((b, bi) => <Text key={bi} style={{ color: colors.textSecondary }}>• {b}</Text>)}
                </View>
              )) : <Text style={{ color: colors.textSecondary }}>{t('forge.noOutlineYet')}</Text>
            ) : bibleTab === 'cast' ? (
              characters.length ? characters.map((ch, i) => (
                <Text key={i} style={{ color: colors.text, marginBottom: 6 }}>{ch.name || t('forge.unnamed')}{ch.role ? ` · ${ch.role}` : ''}</Text>
              )) : <Text style={{ color: colors.textSecondary }}>{t('forge.castEmpty')}</Text>
            ) : (
              <>
                <TextInput
                  value={worldNotes}
                  onChangeText={setWorldNotes}
                  placeholder={t('forge.worldNotesPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  editable={!!story.can_edit_bible}
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                />
                {story.can_edit_bible ? (
                  <WorldPrimaryButton label={t('forge.saveWorldNotes')} tone="story" loading={busy === 'bible'} onPress={async () => {
                    setBusy('bible');
                    try { await api.patchForgeBible(story.id, { world_notes: worldNotes }); await load(); }
                    catch { Alert.alert(t('forge.storyBible'), t('common.actionFailed')); }
                    finally { setBusy(''); }
                  }} />
                ) : null}
              </>
            )}
          </WorldCard>

          {story.is_owner && pendingJoins.length > 0 ? (
            <WorldCard>
              <Text style={[styles.blockTitle, { color: colors.text }]}>{t('forge.joinRequests')}</Text>
              {pendingJoins.map((c) => (
                <View key={c.id} style={styles.rowBetween}>
                  <Text style={{ color: colors.text }}>@{c.user?.username} {t('forge.wants')} {c.role}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable onPress={() => void api.reviewForgeJoin(story.id, c.user.id!, true, c.role).then(load)}>
                      <Text style={{ color: colors.success, fontWeight: '800' }}>{t('forge.approve')}</Text>
                    </Pressable>
                    <Pressable onPress={() => void api.reviewForgeJoin(story.id, c.user.id!, false, c.role).then(load)}>
                      <Text style={{ color: '#F472B6', fontWeight: '800' }}>{t('forge.reject')}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </WorldCard>
          ) : null}

          {pending.length > 0 && story.can_approve ? (
            <WorldCard>
              <Text style={[styles.blockTitle, { color: colors.text }]}>{t('forge.pendingApproval')}</Text>
              {pending.map((seg) => (
                <View key={seg.id} style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('forge.from')} @{seg.author?.username}</Text>
                  <Text style={{ color: colors.text, marginVertical: 6 }}>{seg.content}</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Pressable onPress={() => void api.approveForgeSegment(story.id, seg.id).then(load)}>
                      <Text style={{ color: colors.success, fontWeight: '800' }}>{t('forge.approve')}</Text>
                    </Pressable>
                    <Pressable onPress={() => void api.rejectForgeSegment(story.id, seg.id).then(load)}>
                      <Text style={{ color: '#F472B6', fontWeight: '800' }}>{t('forge.reject')}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </WorldCard>
          ) : null}

          <Text style={[styles.section, { color: colors.text }]}>{t('forge.publishedParts')}</Text>
          {approved.map((seg) => (
            <SegmentCard
              key={seg.id}
              story={story}
              segment={seg}
              draft={dialogueDraft[seg.id] || ''}
              onDraft={(text) => setDialogueDraft((d) => ({ ...d, [seg.id]: text }))}
              revising={reviseId === seg.id}
              reviseText={reviseText}
              onReviseStart={() => { setReviseId(seg.id); setReviseText(seg.content); }}
              onReviseChange={setReviseText}
              onReviseSave={async () => {
                setBusy('revise');
                try {
                  await api.reviseForgeSegment(story.id, seg.id, reviseText);
                  setReviseId(null);
                  await load();
                } catch {
                  Alert.alert(t('forge.revise'), t('common.actionFailed'));
                } finally {
                  setBusy('');
                }
              }}
              onPostDialogue={async () => {
                const text = (dialogueDraft[seg.id] || '').trim();
                if (!text) return;
                try {
                  await api.postForgeDialogue(story.id, seg.id, text);
                  setDialogueDraft((d) => ({ ...d, [seg.id]: '' }));
                  await load();
                } catch {
                  Alert.alert(t('forge.innerDialogue'), t('common.actionFailed'));
                }
              }}
            />
          ))}

          {story.can_contribute !== false ? (
            <WorldCard>
              <Text style={[styles.blockTitle, { color: colors.text }]}>{t('forge.studioEditor')}</Text>
              {story.require_approval ? <Text style={{ color: colors.warning, marginBottom: 8 }}>{t('forge.approvalRequired')}</Text> : null}
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t('forge.editorPlaceholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                style={[styles.input, styles.editor, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              />
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>
                {draft.trim() ? draft.trim().split(/\s+/).length : 0} {t('forge.words')}
              </Text>
              <WorldPrimaryButton
                label={busy === 'write' ? t('forge.forging') : t('forge.publishPart')}
                tone="story"
                loading={busy === 'write'}
                disabled={!draft.trim()}
                onPress={() => void publishPart()}
              />
            </WorldCard>
          ) : null}

          <WorldCard>
            <Text style={[styles.blockTitle, { color: colors.text }]}>{t('forge.writingBuddy')}</Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>{t('forge.buddyHint')}</Text>
            <View style={styles.wrap}>
              {([
                ['continue', 'forge.buddyContinue'],
                ['rewrite', 'forge.buddyRewrite'],
                ['outline', 'forge.buddyOutline'],
                ['character', 'forge.buddyCharacter'],
                ['critique', 'forge.buddyCritique'],
                ['spark', 'forge.buddySpark'],
                ['twist', 'forge.buddyTwist'],
                ['sensory', 'forge.buddySensory'],
                ['dialogue', 'forge.buddyDialogue'],
              ] as const).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => void runBuddy(key)}
                  style={[styles.buddyChip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>
                    {busy === `buddy-${key}` ? '…' : t(label)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {buddyResult ? (
              <View style={{ marginTop: 10 }}>
                <Text style={{ color: colors.text, lineHeight: 21 }}>
                  {buddyResult.text ||
                    (buddyResult.outline ? formatOutlineForDraft(buddyResult.outline) : '') ||
                    (buddyResult.character ? formatCharacterForDraft(buddyResult.character) : '')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                  <Pressable onPress={insertBuddy}><Text style={{ color: colors.story, fontWeight: '800' }}>{t('forge.insertIntoDraft')}</Text></Pressable>
                  {story.can_edit_bible && (buddyResult.kind === 'outline' || buddyResult.kind === 'character') ? (
                    <Pressable onPress={() => void applyBuddyBible()}><Text style={{ color: colors.story, fontWeight: '800' }}>{t('forge.addToBible')}</Text></Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
          </WorldCard>

          <WorldCard>
            <Text style={[styles.blockTitle, { color: colors.text }]}>{t('forge.contributorsTitle')}</Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
              {t('forge.owner')} · @{story.owner?.username} · {story.contributors_count} {t('forge.contributors')}
            </Text>
            {(story.collaborators || []).filter((c) => c.status === 'accepted').map((c) => (
              <Text key={c.id} style={{ color: colors.text }}>@{c.user?.username} · {c.role}</Text>
            ))}
            {story.is_owner ? (
              <>
                <TextInput
                  value={inviteName}
                  onChangeText={setInviteName}
                  placeholder={t('forge.usernamePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, marginTop: 10 }]}
                />
                <WorldPrimaryButton
                  label={t('forge.inviteSwitchesToCollab')}
                  tone="story"
                  disabled={!inviteName.trim()}
                  onPress={async () => {
                    try {
                      await api.inviteForgeCollaborator(story.id, { username: inviteName.trim(), role: 'writer' });
                      setInviteName('');
                      await load();
                    } catch {
                      Alert.alert(t('forge.contributorsTitle'), t('common.actionFailed'));
                    }
                  }}
                />
              </>
            ) : null}
          </WorldCard>
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

function SegmentCard({
  story,
  segment,
  draft,
  onDraft,
  revising,
  reviseText,
  onReviseStart,
  onReviseChange,
  onReviseSave,
  onPostDialogue,
}: {
  story: ForgeStory;
  segment: ForgeSegment;
  draft: string;
  onDraft: (text: string) => void;
  revising: boolean;
  reviseText: string;
  onReviseStart: () => void;
  onReviseChange: (text: string) => void;
  onReviseSave: () => void;
  onPostDialogue: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useLocale();
  return (
    <WorldCard>
      <Text style={[styles.partLabel, { color: colors.story }]}>
        {t('forge.part')} {segment.order}
        {segment.author?.username ? ` · @${segment.author.username}` : ''}
      </Text>
      {revising ? (
        <>
          <TextInput value={reviseText} onChangeText={onReviseChange} multiline style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]} />
          <WorldPrimaryButton label={t('forge.saveRevision')} tone="story" onPress={onReviseSave} />
        </>
      ) : (
        <Text style={{ color: colors.text, lineHeight: 22 }}>{segment.content}</Text>
      )}
      {story.can_revise && !revising ? (
        <Pressable onPress={onReviseStart} style={{ marginTop: 8 }}>
          <Text style={{ color: colors.story, fontWeight: '700' }}>{t('forge.revise')}</Text>
        </Pressable>
      ) : null}
      {(segment.dialogues || []).map((d) => (
        <Text key={d.id} style={{ color: colors.textSecondary, marginTop: 6, fontSize: 13 }}>
          @{d.author?.username}: {d.text}
        </Text>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
        <TextInput
          value={draft}
          onChangeText={onDraft}
          placeholder={t('forge.addInnerNote')}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { flex: 1, minHeight: 40, marginBottom: 0, color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
        />
        <Pressable onPress={onPostDialogue} style={{ paddingHorizontal: 10 }}>
          <Text style={{ color: colors.story, fontWeight: '800' }}>{t('forge.post')}</Text>
        </Pressable>
      </View>
    </WorldCard>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 56, gap: 12 },
  heroCover: { width: '100%', height: 160, borderRadius: 20 },
  blockTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  section: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  partLabel: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  input: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 15, marginBottom: 10, textAlignVertical: 'top' },
  editor: { minHeight: 140 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  buddyChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
});
