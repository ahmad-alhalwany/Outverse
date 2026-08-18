'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowDownTrayIcon,
  BookmarkIcon,
  CheckIcon,
  ChatBubbleLeftIcon,
  PencilSquareIcon,
  PhotoIcon,
  ShareIcon,
  SparklesIcon,
  UserPlusIcon,
  XMarkIcon,
  ArrowsPointingOutIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { getToken } from '@/lib/auth';
import {
  approveSegment,
  buddyCharacter,
  buddyContinue,
  buddyCritique,
  buddyInspire,
  buddyOutline,
  buddyRewrite,
  displayName,
  fetchForgeStory,
  forgeStoryWsUrl,
  generateCover,
  inviteCollaborator,
  patchBible,
  pdfExportUrl,
  postDialogue,
  postSegment,
  rejectSegment,
  respondInvite,
  requestJoinStory,
  reviewJoinRequest,
  reviseSegment,
  toggleSaveStory,
  updateStory,
  type ForgeCharacter,
  type ForgeDialogue,
  type ForgeOutlineBeat,
  type ForgeSegment,
  type ForgeStory,
} from '@/lib/forgeApi';
import ForgeFocusEditor from '@/components/forge/ForgeFocusEditor';

const PALETTES = {
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
    shadowLg: '0 18px 48px rgba(124,58,237,0.14)',
    hero: 'linear-gradient(135deg, #F8F5FE 0%, #ECE3FB 52%, #DFD0F7 100%)',
    panel: 'rgba(255,255,255,0.92)',
    pending: '#f59e0b',
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
    shadowLg: '0 18px 48px rgba(0,0,0,0.28)',
    hero: 'linear-gradient(135deg, #191140 0%, #251B4D 52%, #32215F 100%)',
    panel: 'rgba(30,23,64,0.92)',
    pending: '#fbbf24',
  },
};

type Colors = (typeof PALETTES)['dark'];

const BUDDY_LABEL_KEY: Record<string, string> = {
  continue: 'forge.buddyContinue',
  rewrite: 'forge.buddyRewrite',
  outline: 'forge.buddyOutline',
  character: 'forge.buddyCharacter',
  critique: 'forge.buddyCritique',
  spark: 'forge.buddySpark',
  twist: 'forge.buddyTwist',
  sensory: 'forge.buddySensory',
  dialogue: 'forge.buddyDialogue',
};

function renderFormattedText(content: string): ReactNode[] {
  const blocks = content.split(/\n/);
  const nodes: ReactNode[] = [];
  blocks.forEach((line, lineIdx) => {
    if (lineIdx > 0) nodes.push(<br key={`br-${lineIdx}`} />);
    const trimmed = line.trim();
    if (trimmed === '* * *' || trimmed === '***') {
      nodes.push(
        <span key={`break-${lineIdx}`} className="my-3 block text-center tracking-[0.4em] opacity-60">
          * * *
        </span>,
      );
      return;
    }
    const img = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) {
      nodes.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`img-${lineIdx}`}
          src={img[2]}
          alt={img[1] || 'scene'}
          className="my-3 max-h-72 w-full rounded-xl object-cover"
        />,
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      nodes.push(
        <strong key={`h-${lineIdx}`} className="mt-2 block text-base md:text-lg">
          {trimmed.slice(3)}
        </strong>,
      );
      return;
    }
    if (trimmed.startsWith('> ')) {
      nodes.push(
        <em key={`q-${lineIdx}`} className="block border-l-2 pl-3 opacity-90">
          {renderInline(trimmed.slice(2))}
        </em>,
      );
      return;
    }
    if (trimmed.startsWith('- ')) {
      nodes.push(
        <span key={`li-${lineIdx}`} className="block pl-3 before:mr-2 before:content-['•']">
          {renderInline(trimmed.slice(2))}
        </span>,
      );
      return;
    }
    nodes.push(<span key={`p-${lineIdx}`}>{renderInline(line)}</span>);
  });
  return nodes;
}

function renderInline(content: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|~[^~]+~|!\[[^\]]*\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('![')) {
      const m = token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (m) {
        parts.push(
          // eslint-disable-next-line @next/next/no-img-element
          <img key={key++} src={m[2]} alt={m[1] || 'scene'} className="my-2 inline-block max-h-48 max-w-full rounded-lg object-cover" />,
        );
      }
    } else if (token.startsWith('**')) parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('~')) parts.push(<u key={key++}>{token.slice(1, -1)}</u>);
    else parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    lastIndex = match.index + token.length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return parts;
}

function SegmentDialogues({
  storyId,
  segment,
  colors,
  onChanged,
}: {
  storyId: number;
  segment: ForgeSegment;
  colors: Colors;
  onChanged: () => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogues = segment.dialogues || [];

  async function submit() {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      await postDialogue(storyId, segment.id, text);
      setDraft('');
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: colors.brownDk }} onClick={() => setOpen((v) => !v)}>
        <ChatBubbleLeftIcon className="h-4 w-4" />
        {t('forge.innerDialogue')} ({segment.dialogues_count ?? dialogues.length})
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-xl border p-3" style={{ borderColor: colors.line, background: colors.card2 }}>
          {dialogues.map((d: ForgeDialogue) => (
            <div key={d.id} className="rounded-lg px-3 py-2 text-sm" style={{ background: colors.panel }}>
              <p>{d.text}</p>
              <p className="mt-1 text-[10px]" style={{ color: colors.text2 }}>— {displayName(d.author)}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-full border px-3 py-1.5 text-xs outline-none"
              style={{ borderColor: colors.line, background: colors.white, color: colors.text }}
              maxLength={280}
              placeholder={t('forge.addInnerNote')}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="button" disabled={busy} onClick={() => void submit()} className="rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ background: colors.brownDk }}>
              {t('forge.post')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ForgeStoryStudio({ storyId }: { storyId: number }) {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const user = useAuthUser();
  const [story, setStory] = useState<ForgeStory | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [bibleTab, setBibleTab] = useState<'outline' | 'cast' | 'world'>('outline');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inviteUser, setInviteUser] = useState('');
  const [inviteRole, setInviteRole] = useState('writer');
  const [busy, setBusy] = useState('');
  const [buddyResult, setBuddyResult] = useState<null | {
    kind: 'continue' | 'rewrite' | 'outline' | 'character' | 'critique' | 'spark' | 'twist' | 'sensory' | 'dialogue';
    text?: string;
    character?: ForgeCharacter;
    outline?: ForgeOutlineBeat[];
  }>(null);
  const [presence, setPresence] = useState<{ user_id: number; username: string }[]>([]);
  const [editingSegmentId, setEditingSegmentId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const [settings, setSettings] = useState({
    title: '',
    premise: '',
    tone: '',
    pov: '',
    content_rules: '',
    max_segments: 12,
    target_words: '' as string | number,
    writing_goal: '' as string | number,
    visibility: 'public',
    studio_mode: 'solo',
    require_approval: false,
    cover_prompt: '',
    genre: 'other',
  });
  const [worldNotes, setWorldNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchForgeStory(storyId);
      setStory(data);
      setWorldNotes(data.world_notes || '');
      setSettings({
        title: data.title,
        premise: data.premise,
        tone: data.tone || '',
        pov: data.pov || '',
        content_rules: data.content_rules || '',
        max_segments: data.max_segments || 12,
        target_words: data.target_words ?? '',
        writing_goal: data.writing_goal ?? '',
        visibility: data.visibility || 'public',
        studio_mode: data.studio_mode || 'solo',
        require_approval: !!data.require_approval,
        cover_prompt: data.cover_prompt || '',
        genre: data.genre || 'other',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setStory(null);
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!storyId || !getToken()) return;
    let dead = false;
    const ws = new WebSocket(forgeStoryWsUrl(storyId));
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'forge.presence') {
          setPresence((prev) => {
            if (msg.event === 'leave') return prev.filter((p) => p.user_id !== msg.user_id);
            if (prev.some((p) => p.user_id === msg.user_id)) return prev;
            return [...prev, { user_id: msg.user_id, username: msg.username || 'writer' }];
          });
        }
        if (msg.type === 'forge.event' && ['segment_created', 'segment_approved', 'segment_revised', 'bible_updated'].includes(msg.event)) {
          void load();
        }
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      if (!dead) wsRef.current = null;
    };
    return () => {
      dead = true;
      ws.close();
    };
  }, [storyId, load]);

  const coverSrc = story?.cover_preview || story?.cover_url || '';
  const progress = useMemo(() => {
    if (!story) return 0;
    const n = story.approved_segment_count ?? story.segment_count ?? 0;
    return Math.min(100, Math.round((n / Math.max(1, story.max_segments)) * 100));
  }, [story]);

  const wordProgress = useMemo(() => {
    if (!story?.writing_goal) return null;
    const words = story.word_count || 0;
    return Math.min(100, Math.round((words / story.writing_goal) * 100));
  }, [story]);

  const myInvite = useMemo(() => {
    if (!story || !user) return null;
    return (story.collaborators || []).find((c) => c.user?.id === user.id && c.status === 'invited');
  }, [story, user]);

  const pendingJoinRequests = useMemo(() => {
    if (!story?.is_owner) return [];
    return (story.collaborators || []).filter((c) => c.status === 'requested');
  }, [story]);

  const isStudioMember = Boolean(story?.is_studio_member || story?.is_owner);
  const draftWords = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  async function handleContribute(e?: React.FormEvent) {
    e?.preventDefault();
    if (!story || !draft.trim()) return;
    setBusy('write');
    try {
      await postSegment(story.id, draft.trim());
      setDraft('');
      setFocusMode(false);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy('');
    }
  }

  async function runBuddy(kind: 'continue' | 'rewrite' | 'outline' | 'character' | 'critique' | 'spark' | 'twist' | 'sensory' | 'dialogue') {
    if (!story) return;
    setBusy(`buddy-${kind}`);
    setBuddyResult(null);
    try {
      if (kind === 'continue') {
        const r = await buddyContinue(story.id);
        setBuddyResult({ kind: 'continue', text: r.text });
      } else if (kind === 'rewrite') {
        const r = await buddyRewrite(story.id, draft || story.premise, 'lyrical');
        setBuddyResult({ kind: 'rewrite', text: r.text });
      } else if (kind === 'outline') {
        const r = await buddyOutline(story.id, false);
        setBuddyResult({ kind: 'outline', outline: r.outline || [] });
      } else if (kind === 'character') {
        const r = await buddyCharacter(story.id, false);
        setBuddyResult({ kind: 'character', character: r.character || {} });
      } else if (kind === 'critique') {
        const r = await buddyCritique(story.id, draft);
        setBuddyResult({ kind: 'critique', text: r.text });
      } else {
        const r = await buddyInspire(story.id, kind, draft);
        setBuddyResult({ kind, text: r.text });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Buddy failed');
    } finally {
      setBusy('');
    }
  }

  async function applyBuddyToBible() {
    if (!story?.can_edit_bible || !buddyResult) return;
    setBusy('bible-apply');
    try {
      if (buddyResult.kind === 'outline' && buddyResult.outline) {
        const updated = await patchBible(story.id, { outline: buddyResult.outline });
        setStory(updated);
        setBibleTab('outline');
      } else if (buddyResult.kind === 'character' && buddyResult.character) {
        const chars = [...(story.characters || []), buddyResult.character];
        const updated = await patchBible(story.id, { characters: chars });
        setStory(updated);
        setBibleTab('cast');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update bible');
    } finally {
      setBusy('');
    }
  }

  function formatCharacterForDraft(ch: ForgeCharacter) {
    const lines = [
      ch.name ? `✦ ${ch.name}` : '✦ New character',
      ch.role ? `Role: ${ch.role}` : '',
      ch.voice ? `Voice: ${ch.voice}` : '',
      ...(ch.traits || []).map((t) => `• ${t}`),
      ch.notes ? `Notes: ${ch.notes}` : '',
    ].filter(Boolean);
    return lines.join('\n');
  }

  function formatOutlineForDraft(outline: ForgeOutlineBeat[]) {
    return outline
      .map((act, i) => {
        const head = `## Act ${act.act ?? i + 1}: ${act.title || 'Untitled'}`;
        const beats = (act.beats || []).map((b) => `- ${b}`).join('\n');
        return beats ? `${head}\n${beats}` : head;
      })
      .join('\n\n');
  }

  function insertBuddyIntoDraft() {
    if (!buddyResult) return;
    let chunk = '';
    if (buddyResult.kind === 'character' && buddyResult.character) {
      chunk = formatCharacterForDraft(buddyResult.character);
    } else if (buddyResult.kind === 'outline' && buddyResult.outline) {
      chunk = formatOutlineForDraft(buddyResult.outline);
    } else {
      chunk = buddyResult.text || '';
    }
    if (!chunk.trim()) return;
    setDraft((d) => (d ? `${d.trim()}\n\n${chunk}` : chunk));
  }

  async function saveWorldNotes() {
    if (!story?.can_edit_bible) return;
    setBusy('bible');
    try {
      await patchBible(story.id, { world_notes: worldNotes });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy('');
    }
  }

  async function handleSaveSettings() {
    if (!story) return;
    setBusy('settings');
    try {
      await updateStory(story.id, {
        title: settings.title,
        premise: settings.premise,
        tone: settings.tone,
        pov: settings.pov,
        content_rules: settings.content_rules,
        max_segments: Number(settings.max_segments) || 12,
        target_words: settings.target_words === '' ? null : Number(settings.target_words),
        writing_goal: settings.writing_goal === '' ? null : Number(settings.writing_goal),
        visibility: settings.visibility as 'public' | 'invite_only',
        studio_mode: settings.studio_mode as 'solo' | 'collab',
        require_approval: settings.require_approval,
        cover_prompt: settings.cover_prompt,
        genre: settings.genre,
      } as Partial<ForgeStory>);
      setSettingsOpen(false);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy('');
    }
  }

  async function handlePdf() {
    if (!story) return;
    const token = getToken();
    const res = await fetch(pdfExportUrl(story.id), {
      headers: token ? { Authorization: `Token ${token}` } : {},
    });
    if (!res.ok) {
      alert(t('forge.pdfExportFailed'));
      return;
    }
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${story.title.replace(/\s+/g, '-')}.pdf`;
    a.click();
    URL.revokeObjectURL(href);
  }

  if (loading) {
    return (
      <WorldShell colors={C} maxWidth="max-w-6xl">
        <p className="py-20 text-center text-sm" style={{ color: C.text2 }}>{t('forge.openingStudio')}</p>
      </WorldShell>
    );
  }

  if (error || !story) {
    return (
      <WorldShell colors={C} maxWidth="max-w-6xl">
        <div className="py-16 text-center">
          <p className="text-sm" style={{ color: C.text2 }}>{error || t('forge.storyNotFound')}</p>
          <Link href="/forge" className="mt-4 inline-block text-sm font-semibold underline" style={{ color: C.brownDk }}>
            {t('forge.backToForge')}
          </Link>
        </div>
      </WorldShell>
    );
  }

  const outline = (story.outline || []) as ForgeOutlineBeat[];
  const characters = (story.characters || []) as ForgeCharacter[];

  // Non-members: read-only preview + join / invite gate (not full studio tools).
  if (!isStudioMember) {
    const cover = story.cover_preview || story.cover_url || '';
    const approved = (story.segments || []).filter((s) => s.status === 'approved');
    const pendingRequest = story.my_collab_status === 'requested';
    return (
      <WorldShell colors={C} maxWidth="max-w-3xl">
        <div className="mb-4">
          <Link href="/forge" className="text-xs font-semibold" style={{ color: C.text2 }}>{t('forge.backToForge')}</Link>
        </div>
        <div className="overflow-hidden rounded-[28px] border" style={{ borderColor: C.line, boxShadow: C.shadowLg, background: C.hero }}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-40 w-full object-cover" />
          ) : (
            <div className="flex h-40 items-center justify-center" style={{ background: C.card }}>
              <PhotoIcon className="h-10 w-10" style={{ color: C.text2 }} />
            </div>
          )}
          <div className="space-y-3 p-6">
            <p className="text-xs uppercase tracking-wide" style={{ color: C.text2 }}>
              {story.studio_mode === 'solo' ? t('forge.privateSoloStudio') : t('forge.collaborativeWorld')} · {story.genre_display}
            </p>
            <h1 className="font-serif text-3xl font-semibold" style={{ color: C.text }}>{story.title}</h1>
            <p className="leading-relaxed" style={{ color: C.text2 }}>{story.premise}</p>
            <p className="text-xs" style={{ color: C.text2 }}>
              {displayName(story.owner)} · {story.approved_segment_count ?? approved.length}/{story.max_segments} {t('forge.parts')}
            </p>
          </div>
        </div>

        {approved.length > 0 && (
          <div className="mt-6 space-y-3">
            <h2 className="text-sm font-semibold" style={{ color: C.text }}>{t('forge.publishedParts')}</h2>
            {approved.slice(0, 3).map((seg) => (
              <article key={seg.id} className="rounded-2xl border p-4 text-sm leading-relaxed" style={{ borderColor: C.line, background: C.panel, color: C.text }}>
                <div className="mb-1 text-xs font-semibold" style={{ color: C.brownDk }}>{t('forge.part')} {seg.order}</div>
                {renderFormattedText(seg.content.slice(0, 420))}{seg.content.length > 420 ? '…' : ''}
              </article>
            ))}
          </div>
        )}

        <div className="mt-6 rounded-2xl border p-5" style={{ borderColor: C.line, background: C.panel }}>
          {myInvite ? (
            <>
              <h3 className="text-base font-semibold" style={{ color: C.text }}>{t('forge.youAreInvited')}</h3>
              <p className="mt-1 text-sm" style={{ color: C.text2 }}>
                {t('forge.joinAsRoleHint', { role: myInvite.role })}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: C.brownDk }} onClick={() => void respondInvite(story.id, true).then(load)}>
                  {t('forge.acceptOpenStudio')}
                </button>
                <button type="button" className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: C.line, color: C.text }} onClick={() => void respondInvite(story.id, false).then(load)}>
                  {t('forge.decline')}
                </button>
              </div>
            </>
          ) : pendingRequest ? (
            <>
              <h3 className="text-base font-semibold" style={{ color: C.text }}>{t('forge.joinRequestPending')}</h3>
              <p className="mt-1 text-sm" style={{ color: C.text2 }}>
                {t('forge.joinRequestPendingHint')}
              </p>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold" style={{ color: C.text }}>{t('forge.requestToJoinTitle')}</h3>
              <p className="mt-1 text-sm" style={{ color: C.text2 }}>
                {t('forge.requestToJoinHint')}
              </p>
              {!user ? (
                <p className="mt-4 text-sm font-semibold" style={{ color: C.brownDk }}>{t('forge.signInToRequest')}</p>
              ) : story.can_request_join ? (
                <button
                  type="button"
                  disabled={busy === 'join'}
                  className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: C.brownDk }}
                  onClick={() => {
                    setBusy('join');
                    void requestJoinStory(story.id)
                      .then(load)
                      .catch((e) => alert(e instanceof Error ? e.message : 'Failed'))
                      .finally(() => setBusy(''));
                  }}
                >
                  <UserPlusIcon className="h-4 w-4" /> {busy === 'join' ? t('forge.sending') : t('forge.requestToJoin')}
                </button>
              ) : (
                <p className="mt-4 text-sm" style={{ color: C.text2 }}>{t('forge.joiningUnavailable')}</p>
              )}
            </>
          )}
        </div>
      </WorldShell>
    );
  }

  return (
    <WorldShell colors={C} maxWidth="max-w-7xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/forge" className="text-xs font-semibold" style={{ color: C.text2 }}>{t('forge.backToForge')}</Link>
          <span className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide" style={{ background: C.card, color: C.text2 }}>
            {story.studio_mode === 'solo' ? t('forge.soloStudio') : t('forge.collabStudio')}
          </span>
          {presence.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: C.text2 }}>
              <UsersIcon className="h-3.5 w-3.5" />
              {t('forge.live')} {presence.map((p) => p.username).join(', ')}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: C.line, color: C.text }} onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}/forge/${story.id}`)}>
            <ShareIcon className="h-4 w-4" /> {t('forge.share')}
          </button>
          <button type="button" className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: C.line, color: C.text }} onClick={() => void toggleSaveStory(story.id).then(load)}>
            <BookmarkIcon className="h-4 w-4" /> {story.is_saved ? t('forge.saved') : t('common.save')}
          </button>
          <button type="button" className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: C.line, color: C.text }} onClick={() => void handlePdf()}>
            <ArrowDownTrayIcon className="h-4 w-4" /> PDF
          </button>
          {story.is_owner && (
            <button type="button" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ background: C.brownDk }} onClick={() => setSettingsOpen(true)}>
              <PencilSquareIcon className="h-4 w-4" /> {t('forge.authorSettings')}
            </button>
          )}
        </div>
      </div>

      {pendingJoinRequests.length > 0 && (
        <div className="mb-4 space-y-2 rounded-2xl border px-4 py-3" style={{ borderColor: C.line, background: C.card }}>
          <p className="text-sm font-semibold">{t('forge.joinRequests')}</p>
          {pendingJoinRequests.map((req) => (
            <div key={req.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{displayName(req.user)} · {t('forge.wants')} <strong>{req.role}</strong></span>
              <div className="flex gap-2">
                <button type="button" className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: '#16a34a' }} onClick={() => void reviewJoinRequest(story.id, req.user!.id!, true, req.role).then(load)}>
                  {t('forge.approve')}
                </button>
                <button type="button" className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: C.line }} onClick={() => void reviewJoinRequest(story.id, req.user!.id!, false).then(load)}>
                  {t('forge.decline')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.5fr)_minmax(260px,0.95fr)]">
        {/* Bible */}
        <aside className="rounded-2xl border p-4 h-fit" style={{ borderColor: C.line, background: C.panel }}>
          <h3 className="mb-3 text-sm font-semibold">{t('forge.storyBible')}</h3>
          <div className="mb-3 flex gap-1">
            {([
              ['outline', 'forge.bibleOutline'],
              ['cast', 'forge.bibleCast'],
              ['world', 'forge.bibleWorld'],
            ] as const).map(([tab, labelKey]) => (
              <button key={tab} type="button" onClick={() => setBibleTab(tab)} className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: bibleTab === tab ? C.brownDk : C.card, color: bibleTab === tab ? '#fff' : C.text2 }}>
                {t(labelKey)}
              </button>
            ))}
          </div>
          {bibleTab === 'outline' && (
            <div className="space-y-2 text-xs">
              {outline.length === 0 && <p style={{ color: C.text2 }}>{t('forge.noOutlineYet')}</p>}
              {outline.map((act, i) => (
                <div key={i} className="rounded-xl border p-2" style={{ borderColor: C.line }}>
                  <div className="font-semibold" style={{ color: C.brownDk }}>{t('forge.act')} {act.act ?? i + 1}: {act.title || t('forge.untitled')}</div>
                  <ul className="mt-1 list-disc pl-4" style={{ color: C.text2 }}>
                    {(act.beats || []).map((b, j) => <li key={j}>{b}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {bibleTab === 'cast' && (
            <div className="space-y-2 text-xs">
              {characters.length === 0 && <p style={{ color: C.text2 }}>{t('forge.castEmpty')}</p>}
              {characters.map((ch, i) => (
                <div key={i} className="rounded-xl border p-2" style={{ borderColor: C.line }}>
                  <div className="font-semibold">{ch.name || t('forge.unnamed')}</div>
                  <div style={{ color: C.text2 }}>{ch.role} · {(ch.traits || []).join(', ')}</div>
                  {ch.voice && <div className="mt-1 italic" style={{ color: C.text2 }}>{ch.voice}</div>}
                </div>
              ))}
            </div>
          )}
          {bibleTab === 'world' && (
            <div className="space-y-2">
              <textarea
                className="min-h-[160px] w-full rounded-xl border p-2 text-xs outline-none"
                style={{ borderColor: C.line, background: C.white, color: C.text }}
                value={worldNotes}
                disabled={!story.can_edit_bible}
                onChange={(e) => setWorldNotes(e.target.value)}
                placeholder={t('forge.worldNotesPlaceholder')}
              />
              {story.can_edit_bible && (
                <button type="button" disabled={busy === 'bible'} onClick={() => void saveWorldNotes()} className="w-full rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ background: C.brownDk }}>
                  {t('forge.saveWorldNotes')}
                </button>
              )}
            </div>
          )}
        </aside>

        {/* Main */}
        <section className="min-w-0">
          <div className="overflow-hidden rounded-[28px] border" style={{ borderColor: C.line, boxShadow: C.shadowLg, background: C.hero }}>
            {coverSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverSrc} alt="" className="h-48 w-full object-cover md:h-64" />
            ) : (
              <div className="flex h-48 items-center justify-center md:h-64" style={{ background: C.card }}>
                <PhotoIcon className="h-12 w-12 opacity-40" />
              </div>
            )}
            <div className="space-y-3 px-5 py-5">
              <div className="flex flex-wrap gap-2 text-xs" style={{ color: C.text2 }}>
                <span className="rounded-full px-2 py-0.5" style={{ background: C.card }}>{story.genre_display}</span>
                <span>{story.approved_segment_count ?? story.segment_count}/{story.max_segments} {t('forge.parts')}</span>
                <span>· {story.word_count || 0} {t('forge.words')}</span>
                {story.my_role && <span className="rounded-full px-2 py-0.5 capitalize" style={{ background: C.card2 }}>{story.my_role}</span>}
              </div>
              <h1 className="font-serif text-3xl font-semibold md:text-4xl" style={{ color: C.text }}>{story.title}</h1>
              <p className="leading-relaxed" style={{ color: C.text2 }}>{story.premise}</p>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: C.card }}>
                <div className="h-full rounded-full" style={{ width: `${progress}%`, background: C.brownDk }} />
              </div>
              {wordProgress != null && (
                <div>
                  <div className="mb-1 flex justify-between text-[10px]" style={{ color: C.text2 }}>
                    <span>{t('forge.writingGoal')}</span>
                    <span>{story.word_count}/{story.writing_goal} ({wordProgress}%)</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ background: C.card }}>
                    <div className="h-full rounded-full" style={{ width: `${wordProgress}%`, background: C.brown }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {(story.segments || []).map((seg) => (
              <article key={seg.id} className="rounded-2xl border p-4 md:p-5" style={{ borderColor: C.line, background: C.panel }}>
                <div className="mb-2 flex items-center justify-between gap-2 text-xs" style={{ color: C.text2 }}>
                  <span className="font-semibold" style={{ color: C.brownDk }}>{t('forge.part')} {seg.order}</span>
                  <span className="flex items-center gap-2">
                    — {displayName(seg.author)}
                    {story.can_revise && (
                      <button type="button" className="underline" onClick={() => { setEditingSegmentId(seg.id); setEditDraft(seg.content); }}>
                        {t('forge.revise')}
                      </button>
                    )}
                  </span>
                </div>
                {editingSegmentId === seg.id ? (
                  <div className="space-y-2">
                    <textarea className="min-h-[120px] w-full rounded-xl border p-3 text-sm outline-none" style={{ borderColor: C.line, background: C.white, color: C.text }} value={editDraft} onChange={(e) => setEditDraft(e.target.value)} />
                    <div className="flex gap-2">
                      <button type="button" className="rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ background: C.brownDk }} onClick={() => void reviseSegment(story.id, seg.id, editDraft).then(() => { setEditingSegmentId(null); return load(); })}>{t('forge.saveRevision')}</button>
                      <button type="button" className="rounded-full border px-3 py-1.5 text-xs" style={{ borderColor: C.line }} onClick={() => setEditingSegmentId(null)}>{t('common.cancel')}</button>
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed md:text-base">{renderFormattedText(seg.content)}</div>
                )}
                <SegmentDialogues storyId={story.id} segment={seg} colors={C} onChanged={load} />
              </article>
            ))}
          </div>

          {story.can_approve && (story.pending_segments || []).length > 0 && (
            <div className="mt-8 space-y-3">
              <h2 className="text-sm font-semibold" style={{ color: C.pending }}>{t('forge.pendingApproval')}</h2>
              {(story.pending_segments || []).map((seg) => (
                <div key={seg.id} className="rounded-2xl border p-4" style={{ borderColor: C.pending, background: C.card }}>
                  <p className="mb-2 text-xs" style={{ color: C.text2 }}>{t('forge.from')} {displayName(seg.author)}</p>
                  <p className="whitespace-pre-wrap text-sm">{seg.content}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ background: '#16a34a' }} onClick={() => void approveSegment(story.id, seg.id).then(load)}>
                      <CheckIcon className="h-4 w-4" /> {t('forge.approve')}
                    </button>
                    <button type="button" className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: C.line }} onClick={() => void rejectSegment(story.id, seg.id).then(load)}>
                      <XMarkIcon className="h-4 w-4" /> {t('forge.reject')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {story.can_contribute && story.status !== 'completed' && (
            <form onSubmit={handleContribute} className={`mt-8 rounded-2xl border p-4 ${focusMode ? 'fixed inset-4 z-50 overflow-y-auto' : ''}`} style={{ borderColor: C.line, background: focusMode ? C.cream : C.card }}>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-semibold">{t('forge.studioEditor')}</label>
                <button type="button" className="inline-flex items-center gap-1 text-xs" style={{ color: C.brownDk }} onClick={() => setFocusMode((v) => !v)}>
                  <ArrowsPointingOutIcon className="h-4 w-4" /> {focusMode ? t('forge.exitFocus') : t('forge.focusMode')}
                </button>
              </div>
              {story.require_approval && !story.is_owner && story.my_role !== 'editor' && (
                <p className="mb-2 text-xs" style={{ color: C.pending }}>{t('forge.approvalRequired')}</p>
              )}
              <ForgeFocusEditor
                value={draft}
                onChange={setDraft}
                colors={C}
                disabled={busy === 'write'}
                placeholder={t('forge.editorPlaceholder')}
              />
              <div className="mt-2 flex items-center justify-between text-xs" style={{ color: C.text2 }}>
                <span>{draftWords} {t('forge.words')}</span>
                <button type="submit" disabled={busy === 'write' || !draft.trim()} className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: C.brownDk }}>
                  {busy === 'write' ? t('forge.sending') : t('forge.publishPart')}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Buddy + collab */}
        <aside className="space-y-4">
          <div className="rounded-2xl border p-4" style={{ borderColor: C.line, background: C.panel }}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <SparklesIcon className="h-4 w-4" /> {t('forge.writingBuddy')}
            </h3>
            <p className="mb-2 text-[10px]" style={{ color: C.text2 }}>{t('forge.buddyHint')}</p>
            <div className="grid grid-cols-2 gap-2">
              {(['continue', 'rewrite', 'outline', 'character', 'critique'] as const).map((k) => (
                <button key={k} type="button" disabled={!!busy} onClick={() => void runBuddy(k)} className="rounded-full border px-2 py-1.5 text-[11px] font-semibold" style={{ borderColor: C.line, color: C.text }}>
                  {busy === `buddy-${k}` ? '…' : t(BUDDY_LABEL_KEY[k])}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['spark', 'twist', 'sensory', 'dialogue'] as const).map((k) => (
                <button key={k} type="button" disabled={!!busy} onClick={() => void runBuddy(k)} className="rounded-full px-2 py-1.5 text-[11px] font-semibold text-white" style={{ background: C.brownDk }}>
                  {busy === `buddy-${k}` ? '…' : t(BUDDY_LABEL_KEY[k])}
                </button>
              ))}
            </div>
            {buddyResult && (
              <div className="mt-3 space-y-2">
                {buddyResult.kind === 'character' && buddyResult.character ? (
                  <div className="max-h-64 overflow-y-auto rounded-xl border p-3" style={{ borderColor: C.line, background: C.card2 }}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.brown }}>{t('forge.suggestedCast')}</p>
                        <h4 className="text-sm font-semibold" style={{ color: C.text }}>
                          {buddyResult.character.name || t('forge.unnamedCharacter')}
                        </h4>
                        {buddyResult.character.role && (
                          <p className="mt-0.5 text-xs" style={{ color: C.text2 }}>{buddyResult.character.role}</p>
                        )}
                      </div>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: C.card, color: C.brownDk }}>
                        {t('forge.characterBadge')}
                      </span>
                    </div>
                    {buddyResult.character.voice && (
                      <p className="mb-2 rounded-lg px-2 py-1.5 text-xs italic" style={{ background: C.panel, color: C.text2 }}>
                        “{buddyResult.character.voice}”
                      </p>
                    )}
                    {(buddyResult.character.traits || []).length > 0 && (
                      <ul className="space-y-1.5">
                        {(buddyResult.character.traits || []).map((trait, i) => (
                          <li key={i} className="flex gap-2 text-xs leading-snug" style={{ color: C.text }}>
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: C.brown }} />
                            <span>{trait}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {buddyResult.character.notes && (
                      <p className="mt-2 border-t pt-2 text-[11px]" style={{ borderColor: C.line, color: C.text2 }}>
                        {buddyResult.character.notes}
                      </p>
                    )}
                  </div>
                ) : buddyResult.kind === 'outline' && buddyResult.outline ? (
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-3" style={{ borderColor: C.line, background: C.card2 }}>
                    {buddyResult.outline.map((act, i) => (
                      <div key={i} className="rounded-lg border p-2" style={{ borderColor: C.line, background: C.panel }}>
                        <div className="text-xs font-semibold" style={{ color: C.brownDk }}>
                          {t('forge.act')} {act.act ?? i + 1}: {act.title || t('forge.untitled')}
                        </div>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px]" style={{ color: C.text2 }}>
                          {(act.beats || []).map((b, j) => <li key={j}>{b}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-xl border p-3 text-xs leading-relaxed whitespace-pre-wrap" style={{ borderColor: C.line, background: C.card2, color: C.text }}>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.brown }}>
                      {t(BUDDY_LABEL_KEY[buddyResult.kind] || buddyResult.kind)}
                    </p>
                    {buddyResult.text}
                  </div>
                )}
                <div className="grid gap-2">
                  <button type="button" className="w-full rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ background: C.brownDk }} onClick={insertBuddyIntoDraft}>
                    {t('forge.insertIntoDraft')}
                  </button>
                  {story.can_edit_bible && (buddyResult.kind === 'outline' || buddyResult.kind === 'character') && (
                    <button type="button" disabled={busy === 'bible-apply'} className="w-full rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: C.line, color: C.text }} onClick={() => void applyBuddyToBible()}>
                      {busy === 'bible-apply' ? t('forge.saving') : t('forge.addToBible')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: C.line, background: C.panel }}>
            <h3 className="mb-3 text-sm font-semibold">{t('forge.contributorsTitle')}</h3>
            <div className="space-y-2 text-sm">
              {story.owner && (
                <div className="flex justify-between"><span>{displayName(story.owner)}</span><span className="text-xs" style={{ color: C.text2 }}>{t('forge.owner')}</span></div>
              )}
              {(story.collaborators || []).filter((c) => c.status === 'accepted').map((c) => (
                <div key={c.id} className="flex justify-between"><span>{displayName(c.user)}</span><span className="text-xs capitalize" style={{ color: C.text2 }}>{c.role}</span></div>
              ))}
            </div>
            {story.is_owner && (
              <div className="mt-4 space-y-2 border-t pt-3" style={{ borderColor: C.line }}>
                <div className="flex gap-2">
                  <input className="min-w-0 flex-1 rounded-full border px-3 py-1.5 text-xs outline-none" style={{ borderColor: C.line, background: C.white, color: C.text }} placeholder={t('forge.usernamePlaceholder')} value={inviteUser} onChange={(e) => setInviteUser(e.target.value)} />
                  <select className="rounded-full border px-2 text-xs" style={{ borderColor: C.line, background: C.white, color: C.text }} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                    <option value="writer">{t('forge.roleWriter')}</option>
                    <option value="editor">{t('forge.roleEditor')}</option>
                    <option value="narrator">{t('forge.roleNarrator')}</option>
                  </select>
                </div>
                <button type="button" onClick={() => void inviteCollaborator(story.id, { username: inviteUser.trim(), role: inviteRole }).then(() => { setInviteUser(''); return load(); })} className="inline-flex w-full items-center justify-center gap-1 rounded-full px-3 py-2 text-xs font-semibold text-white" style={{ background: C.brownDk }}>
                  <UserPlusIcon className="h-4 w-4" /> {t('forge.inviteSwitchesToCollab')}
                </button>
              </div>
            )}
          </div>

          {story.is_owner && (
            <button type="button" disabled={busy === 'cover'} onClick={() => void generateCover(story.id, settings.cover_prompt).then(load)} className="inline-flex w-full items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold" style={{ borderColor: C.line, color: C.text }}>
              <SparklesIcon className="h-4 w-4" /> {busy === 'cover' ? t('forge.generating') : t('forge.aiCover')}
            </button>
          )}
        </aside>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-5" style={{ background: C.cream, borderColor: C.line }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('forge.authorSettingsTitle')}</h2>
              <button type="button" onClick={() => setSettingsOpen(false)}><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              {([
                ['title', 'forge.titleLabel'],
                ['premise', 'forge.descriptionLabel'],
                ['tone', 'forge.toneLabel'],
                ['pov', 'forge.povLabel'],
                ['content_rules', 'forge.contentRulesLabel'],
                ['cover_prompt', 'forge.coverPromptLabel'],
              ] as const).map(([key, labelKey]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-xs font-semibold" style={{ color: C.text2 }}>{t(labelKey)}</span>
                  {key === 'premise' || key === 'content_rules' ? (
                    <textarea className="w-full rounded-xl border p-2 outline-none" style={{ borderColor: C.line, background: C.white, color: C.text }} rows={3} value={String(settings[key])} onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))} />
                  ) : (
                    <input className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line, background: C.white, color: C.text }} value={String(settings[key])} onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))} />
                  )}
                </label>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold" style={{ color: C.text2 }}>{t('forge.maxPartsLabel')}</span>
                  <input type="number" min={2} max={100} className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line, background: C.white, color: C.text }} value={settings.max_segments} onChange={(e) => setSettings((s) => ({ ...s, max_segments: Number(e.target.value) }))} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold" style={{ color: C.text2 }}>{t('forge.writingGoalWords')}</span>
                  <input type="number" min={0} className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line, background: C.white, color: C.text }} value={settings.writing_goal} onChange={(e) => setSettings((s) => ({ ...s, writing_goal: e.target.value }))} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold" style={{ color: C.text2 }}>{t('forge.studioMode')}</span>
                <select className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line, background: C.white, color: C.text }} value={settings.studio_mode} onChange={(e) => setSettings((s) => ({ ...s, studio_mode: e.target.value }))}>
                  <option value="solo">{t('forge.studioModeSolo')}</option>
                  <option value="collab">{t('forge.studioModeCollab')}</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold" style={{ color: C.text2 }}>{t('forge.visibilityLabel')}</span>
                <select className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line, background: C.white, color: C.text }} value={settings.visibility} onChange={(e) => setSettings((s) => ({ ...s, visibility: e.target.value }))}>
                  <option value="public">{t('forge.visibilityPublic')}</option>
                  <option value="invite_only">{t('forge.visibilityInviteOnly')}</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settings.require_approval} onChange={(e) => setSettings((s) => ({ ...s, require_approval: e.target.checked }))} />
                {t('forge.requireApprovalForParts')}
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-full px-4 py-2 text-sm" onClick={() => setSettingsOpen(false)}>{t('common.cancel')}</button>
              <button type="button" disabled={busy === 'settings'} onClick={() => void handleSaveSettings()} className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: C.brownDk }}>{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
    </WorldShell>
  );
}
