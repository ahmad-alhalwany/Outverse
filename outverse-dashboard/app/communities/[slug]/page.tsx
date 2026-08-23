'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { UserGroupIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import CommunityConstellationSection from '@/components/communities/CommunityConstellationSection';
import CommunityRitualSection from '@/components/communities/CommunityRitualSection';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { useLocale } from '@/components/LocaleProvider';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { mapPost, type ApiPost } from '@/utils/postMapper';
import {
  fetchCommunityResult,
  joinCommunity,
  leaveCommunity,
  fetchCommunityMembers,
  fetchPendingMembers,
  approveMember,
  rejectMember,
  kickMember,
  banMember,
  unbanMember,
  fetchBannedMembers,
  setModerator,
  updateCommunityRules,
  createCommunityPost,
  fetchCommunityPosts,
  fetchModQueue,
  resolveModQueueItem,
  updateCommunityGates,
  fetchCommunityChannels,
  createCommunityChannel,
  updateCommunityChannel,
  deleteCommunityChannel,
  joinCommunityChannel,
  fetchCommunityWiki,
  createOrUpdateWikiPage,
  fetchCommunityConstellation,
  fetchCommunityRitual,
  completeCommunityRitual,
  type Community,
  type CommunityMember,
  type CommunityPendingMember,
  type CommunityBannedMember,
  type CommunityFeedSort,
  type CommunityModQueueItem,
  type CommunityChannel,
  type CommunityWikiPage,
  type CommunityConstellation,
  type CommunityRitual,
} from '@/lib/communityApi';

export default function CommunityDetailPage() {
  const { t } = useLocale();
  const confirm = useConfirm();
  const me = useAuthUser();
  const params = useParams();
  const raw = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const slug = raw ? decodeURIComponent(raw) : '';

  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [pending, setPending] = useState<CommunityPendingMember[]>([]);
  const [banned, setBanned] = useState<CommunityBannedMember[]>([]);
  const [rulesEditing, setRulesEditing] = useState(false);
  const [rulesDraft, setRulesDraft] = useState('');
  const [rulesBusy, setRulesBusy] = useState(false);
  const [postText, setPostText] = useState('');
  const [postFlair, setPostFlair] = useState('');
  const [postSpoiler, setPostSpoiler] = useState(false);
  const [postBusy, setPostBusy] = useState(false);
  const [postError, setPostError] = useState('');
  const [flairDraft, setFlairDraft] = useState('');
  const [coverUrlDraft, setCoverUrlDraft] = useState('');
  const [wikiFormOpen, setWikiFormOpen] = useState(false);
  const [wikiEditSlug, setWikiEditSlug] = useState<string | null>(null);
  const [wikiTitle, setWikiTitle] = useState('');
  const [wikiBody, setWikiBody] = useState('');
  const [wikiBusy, setWikiBusy] = useState(false);
  const [wikiError, setWikiError] = useState('');
  const [sort, setSort] = useState<CommunityFeedSort>('new');
  const [modQueue, setModQueue] = useState<CommunityModQueueItem[]>([]);
  const [modQueueOpen, setModQueueOpen] = useState(false);
  const [channels, setChannels] = useState<CommunityChannel[]>([]);
  const [wiki, setWiki] = useState<CommunityWikiPage[]>([]);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelCategory, setNewChannelCategory] = useState('General');
  const [newChannelSlowmode, setNewChannelSlowmode] = useState('0');
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice' | 'stage'>('text');
  const [channelDrafts, setChannelDrafts] = useState<Record<number, {
    name: string;
    category: string;
    slowmode_seconds: string;
    channel_type: 'text' | 'voice' | 'stage';
  }>>({});
  const [channelBusy, setChannelBusy] = useState(false);
  const [constellation, setConstellation] = useState<CommunityConstellation | null>(null);
  const [ritual, setRitual] = useState<CommunityRitual | null>(null);
  const [ritualBusy, setRitualBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    setLoadError(false);
    try {
      const [{ community: c, status }, feedPosts, chs, wikiPages] = await Promise.all([
        fetchCommunityResult(slug),
        fetchCommunityPosts(slug, sort),
        fetchCommunityChannels(slug),
        fetchCommunityWiki(slug),
      ]);
      if (!c) {
        if (status === 404) {
          setNotFound(true);
        } else {
          setLoadError(true);
        }
        setCommunity(null);
        setPosts([]);
        return;
      }
      setCommunity(c);
      setPosts(feedPosts as ApiPost[]);
      setChannels(chs);
      setChannelDrafts(
        chs.reduce<Record<number, {
          name: string;
          category: string;
          slowmode_seconds: string;
          channel_type: 'text' | 'voice' | 'stage';
        }>>((acc, ch) => {
          acc[ch.id] = {
            name: ch.name,
            category: ch.category || 'General',
            slowmode_seconds: String(ch.slowmode_seconds || 0),
            channel_type: ch.channel_type || 'text',
          };
          return acc;
        }, {}),
      );
      setWiki(wikiPages);
      setFlairDraft((c.flair_options || []).join(', '));
      setCoverUrlDraft(c.cover_url || '');
    } finally {
      setLoading(false);
    }
  }, [slug, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!community?.is_moderator || !slug) return;
    void fetchModQueue(slug).then(setModQueue);
  }, [community?.is_moderator, slug]);

  useEffect(() => {
    if (!slug) return;
    void fetchCommunityConstellation(slug).then(setConstellation);
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    void fetchCommunityRitual(slug).then(setRitual);
  }, [slug]);

  const handleCompleteRitual = useCallback(async () => {
    if (!slug) return;
    setRitualBusy(true);
    try {
      const updated = await completeCommunityRitual(slug);
      if (updated) setRitual(updated);
    } finally {
      setRitualBusy(false);
    }
  }, [slug]);

  const loadManagement = useCallback(async () => {
    if (!slug) return;
    const [m, p, b] = await Promise.all([
      fetchCommunityMembers(slug),
      fetchPendingMembers(slug),
      fetchBannedMembers(slug),
    ]);
    setMembers(m);
    setPending(p);
    setBanned(b);
  }, [slug]);

  useEffect(() => {
    if (manageOpen) void loadManagement();
  }, [manageOpen, loadManagement]);

  const loadModQueue = useCallback(async () => {
    if (!slug) return;
    const rows = await fetchModQueue(slug);
    setModQueue(rows);
  }, [slug]);

  useEffect(() => {
    if (modQueueOpen) void loadModQueue();
  }, [modQueueOpen, loadModQueue]);

  const handleToggleMembership = async () => {
    if (!community || joinBusy) return;
    setJoinBusy(true);
    try {
      const updated =
        community.is_member || community.is_pending
          ? await leaveCommunity(slug)
          : await joinCommunity(slug);
      if (updated) setCommunity(updated);
    } finally {
      setJoinBusy(false);
    }
  };

  const handleApprove = async (userId: number) => {
    if (await approveMember(slug, userId)) {
      await loadManagement();
      setCommunity((c) => (c ? { ...c, members_count: c.members_count + 1 } : c));
    }
  };

  const handleReject = async (userId: number) => {
    if (await rejectMember(slug, userId)) {
      await loadManagement();
    }
  };

  const handleKick = async (userId: number) => {
    if (!(await confirm(t('communities.confirmKick'), { danger: true, confirmLabel: t('communities.kick') }))) return;
    if (await kickMember(slug, userId)) {
      await loadManagement();
      setCommunity((c) => (c ? { ...c, members_count: Math.max(0, c.members_count - 1) } : c));
    }
  };

  const handleBan = async (userId: number) => {
    if (!(await confirm(t('communities.confirmBan'), { danger: true, confirmLabel: t('communities.ban') }))) return;
    if (await banMember(slug, userId)) {
      await loadManagement();
      setCommunity((c) => (c ? { ...c, members_count: Math.max(0, c.members_count - 1) } : c));
    }
  };

  const handleToggleModerator = async (userId: number, next: boolean) => {
    if (await setModerator(slug, userId, next)) {
      await loadManagement();
    }
  };

  const handleUnban = async (userId: number) => {
    if (await unbanMember(slug, userId)) {
      await loadManagement();
    }
  };

  const handleStartWikiEdit = (page?: CommunityWikiPage) => {
    setWikiEditSlug(page ? page.slug : null);
    setWikiTitle(page ? page.title : '');
    setWikiBody(page ? page.body : '');
    setWikiError('');
    setWikiFormOpen(true);
  };

  const handleSaveWikiPage = async () => {
    if (!wikiTitle.trim() || wikiBusy) return;
    setWikiBusy(true);
    setWikiError('');
    try {
      const saved = await createOrUpdateWikiPage(slug, {
        title: wikiTitle.trim(),
        body: wikiBody,
        ...(wikiEditSlug ? { slug: wikiEditSlug } : {}),
      });
      if (saved) {
        setWiki((prev) => {
          const idx = prev.findIndex((p) => p.slug === saved.slug);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [...prev, saved];
        });
        setWikiFormOpen(false);
        setWikiEditSlug(null);
        setWikiTitle('');
        setWikiBody('');
      } else {
        setWikiError(t('communities.wikiSaveFailed'));
      }
    } finally {
      setWikiBusy(false);
    }
  };

  const handleStartRulesEdit = () => {
    setRulesDraft((community?.rules || []).join('\n'));
    setRulesEditing(true);
  };

  const handleSaveRules = async () => {
    if (!community || rulesBusy) return;
    setRulesBusy(true);
    try {
      const rules = rulesDraft
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const updated = await updateCommunityRules(slug, rules);
      if (updated) {
        setCommunity(updated);
        setRulesEditing(false);
      }
    } finally {
      setRulesBusy(false);
    }
  };

  const handleCreatePost = async () => {
    if (!community || !postText.trim() || postBusy || community.is_banned) return;
    setPostBusy(true);
    setPostError('');
    try {
      const ok = await createCommunityPost(community.id, postText, postFlair || undefined, postSpoiler);
      if (ok) {
        setPostText('');
        setPostFlair('');
        setPostSpoiler(false);
        await load();
      } else {
        setPostError(t('communities.postFailed'));
      }
    } finally {
      setPostBusy(false);
    }
  };

  const sortOptions: { value: CommunityFeedSort; label: string }[] = [
    { value: 'new', label: t('communities.sortNew') },
    { value: 'top', label: t('communities.sortTop') },
    { value: 'hot', label: t('communities.sortHot') },
    { value: 'controversial', label: t('communities.sortControversial') },
  ];

  const handleModResolve = async (flagId: number, action: 'approve' | 'remove' | 'ban') => {
    if (!slug) return;
    const ok = await resolveModQueueItem(slug, flagId, action);
    if (ok) {
      setModQueue((prev) => prev.filter((item) => item.id !== flagId));
      if (action !== 'approve') await load();
    }
  };

  const updateChannelDraft = (
    channelId: number,
    patch: Partial<{ name: string; category: string; slowmode_seconds: string; channel_type: 'text' | 'voice' | 'stage' }>,
  ) => {
    setChannelDrafts((prev) => {
      const channel = channels.find((ch) => ch.id === channelId);
      const existing = prev[channelId];
      return {
        ...prev,
        [channelId]: {
          name: existing?.name ?? channel?.name ?? '',
          category: existing?.category ?? channel?.category ?? 'General',
          slowmode_seconds: existing?.slowmode_seconds ?? String(channel?.slowmode_seconds || 0),
          channel_type: existing?.channel_type ?? channel?.channel_type ?? 'text',
          ...patch,
        },
      };
    });
  };

  const handleSaveChannel = async (channelId: number) => {
    const draft = channelDrafts[channelId];
    if (!draft || channelBusy) return;
    setChannelBusy(true);
    try {
      const updated = await updateCommunityChannel(slug, channelId, {
        name: draft.name.trim(),
        category: draft.category.trim() || 'General',
        slowmode_seconds: Math.max(0, Number.parseInt(draft.slowmode_seconds, 10) || 0),
        channel_type: draft.channel_type,
      });
      if (updated) setChannels((prev) => prev.map((ch) => (ch.id === channelId ? updated : ch)));
    } finally {
      setChannelBusy(false);
    }
  };

  const handleDeleteChannel = async (channelId: number) => {
    if (channelBusy) return;
    if (!(await confirm(t('communities.deleteChannelConfirm'), { danger: true, confirmLabel: t('common.delete') }))) return;
    setChannelBusy(true);
    try {
      if (await deleteCommunityChannel(slug, channelId)) {
        setChannels((prev) => prev.filter((ch) => ch.id !== channelId));
      }
    } finally {
      setChannelBusy(false);
    }
  };

  const channelIcon = (type?: CommunityChannel['channel_type']) => {
    if (type === 'voice') return '🔊';
    if (type === 'stage') return '🎤';
    return '#';
  };

  const mappedPosts = posts.map((post) => mapPost(post));

  const joinLabel = community?.is_banned
    ? t('communities.banned')
    : community?.is_pending
    ? t('communities.cancelRequest')
    : community?.is_member
      ? t('communities.leave')
      : community?.privacy === 'private'
        ? t('communities.requestToJoin')
        : t('communities.join');

  const isCreator = !!me && !!community && me.username === community.creator_username;

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-2xl mx-auto px-4 pb-16">
      {loading ? (
        <div className="pt-4 space-y-4">
          <div className="h-36 rounded-2xl skeleton-pulse" />
          <div className="h-4 w-1/2 rounded skeleton-pulse" />
          <div className="h-24 rounded-2xl skeleton-pulse" />
        </div>
      ) : loadError ? (
        <div className="pt-16">
          <ErrorState
            message={t('communities.loadError')}
            retryLabel={t('communities.retry')}
            onRetry={() => void load()}
          />
        </div>
      ) : notFound || !community ? (
        <div className="text-center py-16 text-text-secondary">{t('communities.notFound')}</div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6 mb-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {community.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={community.cover_url}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-lab to-bazaar text-white">
                    <UserGroupIcon className="h-6 w-6" />
                  </span>
                )}
                <div className="min-w-0">
                  <h1 className="text-xl font-bold truncate">{community.name}</h1>
                  <p className="text-text-secondary text-sm">
                    {t('communities.memberCount', { count: String(community.members_count) })}
                    {' · '}
                    {t('communities.postCount', { count: String(community.posts_count) })}
                    {' · '}
                    {community.privacy === 'private' ? t('communities.private') : t('communities.public')}
                    {community.is_nsfw ? ` · ${t('communities.nsfwBadge')}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <button
                  type="button"
                  disabled={joinBusy || community.is_banned}
                  onClick={() => void handleToggleMembership()}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                    community.is_member || community.is_pending ? 'bg-surface text-text-secondary' : community.is_banned ? 'bg-red-600/10 text-red-600' : 'bg-vault text-white'
                  }`}
                >
                  {joinLabel}
                </button>
                {community.is_moderator && (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => setManageOpen((v) => !v)}
                      className="flex items-center gap-1 text-xs font-semibold text-text-secondary"
                    >
                      <ShieldCheckIcon className="h-4 w-4" />
                      {t('communities.members')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModQueueOpen((v) => !v)}
                      className="text-xs font-semibold text-text-secondary"
                    >
                      {t('communities.modQueue')}
                      {modQueue.length > 0 && modQueueOpen === false ? ` (${modQueue.length})` : ''}
                    </button>
                    <div className="mt-2 w-52 rounded-xl border border-surface bg-surface/40 p-3 text-left space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                        {t('communities.gatesTitle')}
                      </p>
                      <label className="flex items-center justify-between gap-2 text-xs text-text-primary">
                        <span>{t('communities.gateNsfw')}</span>
                        <input
                          type="checkbox"
                          checked={!!community.is_nsfw}
                          onChange={(e) => {
                            void updateCommunityGates(slug, { is_nsfw: e.target.checked }).then((c) => {
                              if (c) setCommunity(c);
                            });
                          }}
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2 text-xs text-text-primary">
                        <span>{t('communities.gateSpoilers')}</span>
                        <input
                          type="checkbox"
                          checked={community.spoilers_enabled !== false}
                          onChange={(e) => {
                            void updateCommunityGates(slug, { spoilers_enabled: e.target.checked }).then((c) => {
                              if (c) setCommunity(c);
                            });
                          }}
                        />
                      </label>
                      <select
                        className="w-full rounded-lg border border-surface bg-background px-2 py-1 text-xs"
                        value={community.posting_permission || 'members'}
                        onChange={(e) => {
                          const posting_permission = e.target.value as 'members' | 'mods';
                          void updateCommunityGates(slug, { posting_permission }).then((c) => {
                            if (c) setCommunity(c);
                          });
                        }}
                      >
                        <option value="members">{t('communities.gatePostingMembers')}</option>
                        <option value="mods">{t('communities.gatePostingMods')}</option>
                      </select>
                      <input
                        value={flairDraft}
                        onChange={(e) => setFlairDraft(e.target.value)}
                        onBlur={() => {
                          const options = flairDraft
                            .split(',')
                            .map((f) => f.trim())
                            .filter(Boolean);
                          void updateCommunityGates(slug, { flair_options: options }).then((c) => {
                            if (c) setCommunity(c);
                          });
                        }}
                        placeholder={t('communities.flairOptionsLabel')}
                        className="w-full rounded-lg border border-surface bg-background px-2 py-1 text-xs"
                      />
                      <input
                        value={coverUrlDraft}
                        onChange={(e) => setCoverUrlDraft(e.target.value)}
                        onBlur={() => {
                          void updateCommunityGates(slug, { cover_url: coverUrlDraft.trim() }).then((c) => {
                            if (c) setCommunity(c);
                          });
                        }}
                        placeholder={t('communities.coverUrlLabel')}
                        className="w-full rounded-lg border border-surface bg-background px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            {community.description && (
              <p className="mt-4 text-sm text-text-secondary">{community.description}</p>
            )}

            <div className="mt-4 rounded-xl border border-surface bg-surface/30 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-text-secondary">{t('communities.rules')}</p>
                {community.is_moderator && !rulesEditing && (
                  <button
                    type="button"
                    onClick={handleStartRulesEdit}
                    className="text-xs font-semibold text-vault"
                  >
                    {t('communities.editRules')}
                  </button>
                )}
              </div>
              {rulesEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={rulesDraft}
                    onChange={(e) => setRulesDraft(e.target.value)}
                    rows={5}
                    placeholder={t('communities.rulesPlaceholder')}
                    className="w-full rounded-lg border border-surface bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-vault/40"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRulesEditing(false)}
                      className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      disabled={rulesBusy}
                      onClick={() => void handleSaveRules()}
                      className="rounded-lg bg-vault px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {t('communities.saveRules')}
                    </button>
                  </div>
                </div>
              ) : community.rules?.length ? (
                <ol className="list-decimal space-y-1 pl-5 text-sm text-text-secondary">
                  {community.rules.map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-text-secondary">{t('communities.noRules')}</p>
              )}
            </div>

            {ritual ? (
              <CommunityRitualSection data={ritual} onComplete={() => void handleCompleteRitual()} busy={ritualBusy} />
            ) : null}
            {constellation ? <CommunityConstellationSection data={constellation} /> : null}

            {/* Channels (Discord Pack) */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setChannelsOpen((v) => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-text-secondary mb-2"
              >
                <span>#</span>
                <span>{t('communities.channelsTitle', { count: String(channels.length) })}</span>
                <span>{channelsOpen ? '▲' : '▼'}</span>
              </button>
              {channelsOpen && (
                <div className="space-y-2 rounded-xl border border-surface bg-surface/30 p-3">
                  {channels.length === 0 ? (
                    <p className="text-sm text-text-secondary">#️⃣ {t('communities.noChannels')}</p>
                  ) : (
                    <ul className="space-y-1">
                      {Object.entries(
                        channels.reduce<Record<string, CommunityChannel[]>>((acc, ch) => {
                          const cat = ch.category || 'General';
                          if (!acc[cat]) acc[cat] = [];
                          acc[cat].push(ch);
                          return acc;
                        }, {}),
                      ).map(([cat, chs]) => (
                        <li key={cat}>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-1 mt-2 first:mt-0">
                            {cat}
                          </p>
                          <ul className="space-y-0.5">
                            {chs.map((ch) => {
                              const draft = channelDrafts[ch.id] || {
                                name: ch.name,
                                category: ch.category || 'General',
                                slowmode_seconds: String(ch.slowmode_seconds || 0),
                                channel_type: ch.channel_type || 'text',
                              };
                              return (
                                <li key={ch.id} className="rounded-lg hover:bg-surface/60">
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-sm text-text-primary hover:bg-surface"
                                    onClick={() => {
                                      void (async () => {
                                        if (community.is_member) {
                                          await joinCommunityChannel(slug, ch.id);
                                        }
                                        const stageHint = ch.channel_type === 'voice' || ch.channel_type === 'stage' ? '&stage=1' : '';
                                        window.location.href = `/chat?room=${ch.id}${stageHint}`;
                                      })();
                                    }}
                                  >
                                    <span className="text-text-secondary">{channelIcon(ch.channel_type)}</span>
                                    <span className="font-medium">{ch.name}</span>
                                    {ch.unread_count ? (
                                      <span className="ml-auto rounded-full bg-vault px-2 py-0.5 text-[10px] font-bold text-white">
                                        {ch.unread_count > 99 ? '99+' : ch.unread_count}
                                      </span>
                                    ) : null}
                                    {ch.slowmode_seconds > 0 && (
                                      <span className="ml-1 text-[10px] text-text-secondary">
                                        ⏱{ch.slowmode_seconds}s
                                      </span>
                                    )}
                                  </button>
                                  {community.is_moderator && (
                                    <div className="grid grid-cols-2 gap-2 px-2 pb-2 sm:grid-cols-[1fr_1fr_5rem_6rem_auto_auto]">
                                      <input
                                        value={draft.name}
                                        onChange={(e) => updateChannelDraft(ch.id, { name: e.target.value })}
                                        placeholder={t('communities.channelNamePlaceholder')}
                                        className="rounded-lg border border-surface bg-background px-2 py-1 text-xs"
                                      />
                                      <input
                                        value={draft.category}
                                        onChange={(e) => updateChannelDraft(ch.id, { category: e.target.value })}
                                        placeholder={t('communities.channelCategoryPlaceholder')}
                                        className="rounded-lg border border-surface bg-background px-2 py-1 text-xs"
                                      />
                                      <input
                                        value={draft.slowmode_seconds}
                                        onChange={(e) => updateChannelDraft(ch.id, { slowmode_seconds: e.target.value })}
                                        type="number"
                                        min={0}
                                        placeholder={t('communities.channelSlowPlaceholder')}
                                        className="rounded-lg border border-surface bg-background px-2 py-1 text-xs"
                                      />
                                      <select
                                        value={draft.channel_type}
                                        onChange={(e) => updateChannelDraft(ch.id, { channel_type: e.target.value as 'text' | 'voice' | 'stage' })}
                                        className="rounded-lg border border-surface bg-background px-2 py-1 text-xs"
                                      >
                                        <option value="text">{t('communities.channelTypeText')}</option>
                                        <option value="voice">{t('communities.channelTypeVoice')}</option>
                                        <option value="stage">{t('communities.channelTypeStage')}</option>
                                      </select>
                                      <button
                                        type="button"
                                        disabled={channelBusy || !draft.name.trim()}
                                        onClick={() => void handleSaveChannel(ch.id)}
                                        className="rounded-lg bg-vault px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                                      >
                                        {t('common.save')}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={channelBusy}
                                        onClick={() => void handleDeleteChannel(ch.id)}
                                        className="rounded-lg bg-red-600/10 px-2 py-1 text-xs font-semibold text-red-600 disabled:opacity-50"
                                      >
                                        {t('common.delete')}
                                      </button>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  )}
                  {community.is_moderator && (
                    <div className="flex flex-wrap gap-2 border-t border-surface pt-3">
                      <input
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                        placeholder={t('communities.newChannelNamePlaceholder')}
                        className="min-w-[140px] flex-1 rounded-lg border border-surface bg-background px-3 py-2 text-sm"
                      />
                      <input
                        value={newChannelCategory}
                        onChange={(e) => setNewChannelCategory(e.target.value)}
                        placeholder={t('communities.channelCategoryPlaceholder')}
                        className="w-28 rounded-lg border border-surface bg-background px-3 py-2 text-sm"
                      />
                      <input
                        value={newChannelSlowmode}
                        onChange={(e) => setNewChannelSlowmode(e.target.value)}
                        type="number"
                        min={0}
                        placeholder={t('communities.newChannelSlowmodePlaceholder')}
                        className="w-24 rounded-lg border border-surface bg-background px-3 py-2 text-sm"
                      />
                      <select
                        value={newChannelType}
                        onChange={(e) => setNewChannelType(e.target.value as 'text' | 'voice' | 'stage')}
                        className="w-28 rounded-lg border border-surface bg-background px-3 py-2 text-sm"
                      >
                        <option value="text">{t('communities.channelTypeText')}</option>
                        <option value="voice">{t('communities.channelTypeVoice')}</option>
                        <option value="stage">{t('communities.channelTypeStage')}</option>
                      </select>
                      <button
                        type="button"
                        disabled={channelBusy || !newChannelName.trim()}
                        className="rounded-lg bg-vault px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        onClick={() => {
                          void (async () => {
                            setChannelBusy(true);
                            const created = await createCommunityChannel(slug, {
                              name: newChannelName.trim(),
                              category: newChannelCategory.trim() || 'General',
                              slowmode_seconds: Math.max(0, Number.parseInt(newChannelSlowmode, 10) || 0),
                              channel_type: newChannelType,
                            });
                            setChannelBusy(false);
                            if (created) {
                              setChannels((prev) => [...prev, created]);
                              setNewChannelName('');
                              setNewChannelSlowmode('0');
                              setNewChannelType('text');
                            }
                          })();
                        }}
                      >
                        {channelBusy ? '…' : t('communities.create')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Wiki */}
            {(wiki.length > 0 || community.is_moderator) && (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-text-secondary">{t('communities.wikiSectionTitle')}</p>
                  {community.is_moderator && (
                    <button
                      type="button"
                      onClick={() => (wikiFormOpen ? setWikiFormOpen(false) : handleStartWikiEdit())}
                      className="text-xs font-semibold text-vault"
                    >
                      {t('communities.newWikiPage')}
                    </button>
                  )}
                </div>
                {wiki.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {wiki.map((page) => (
                      <li key={page.id} className="flex items-center gap-1">
                        <Link
                          href={`/communities/${slug}/wiki/${page.slug}`}
                          className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-text-primary hover:bg-vault/10 transition-colors"
                        >
                          {page.title}
                        </Link>
                        {community.is_moderator && (
                          <button
                            type="button"
                            onClick={() => handleStartWikiEdit(page)}
                            className="text-[10px] font-semibold text-text-secondary hover:text-vault"
                          >
                            {t('communities.editWikiPage')}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {wikiFormOpen && community.is_moderator && (
                  <div className="mt-2 space-y-2 rounded-xl border border-surface bg-surface/30 p-3">
                    <input
                      value={wikiTitle}
                      onChange={(e) => setWikiTitle(e.target.value)}
                      placeholder={t('communities.wikiTitleLabel')}
                      className="w-full rounded-lg border border-surface bg-background px-3 py-2 text-sm"
                    />
                    <textarea
                      value={wikiBody}
                      onChange={(e) => setWikiBody(e.target.value)}
                      placeholder={t('communities.wikiBodyLabel')}
                      rows={4}
                      className="w-full rounded-lg border border-surface bg-background px-3 py-2 text-sm"
                    />
                    {wikiError && <p className="text-xs text-red-500">{wikiError}</p>}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setWikiFormOpen(false)}
                        className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        type="button"
                        disabled={wikiBusy || !wikiTitle.trim()}
                        onClick={() => void handleSaveWikiPage()}
                        className="rounded-lg bg-vault px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {wikiBusy ? t('communities.wikiSaving') : t('communities.wikiSave')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {manageOpen && community.is_moderator && (
              <div className="mt-4 space-y-4 rounded-xl border border-surface bg-surface/30 p-4">
                {pending.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-text-secondary">{t('communities.pendingRequests')}</p>
                    <ul className="space-y-2">
                      {pending.map((p) => (
                        <li key={p.id} className="flex items-center justify-between text-sm">
                          <span>{p.username}</span>
                          <span className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleApprove(p.id)}
                              className="rounded-lg bg-vault px-3 py-1 text-xs font-semibold text-white"
                            >
                              {t('communities.approve')}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleReject(p.id)}
                              className="rounded-lg bg-surface px-3 py-1 text-xs font-semibold text-text-secondary"
                            >
                              {t('communities.reject')}
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {pending.length === 0 && community.privacy === 'private' && (
                  <p className="text-xs text-text-secondary">{t('communities.noPendingRequests')}</p>
                )}
                <div>
                  <p className="mb-2 text-xs font-semibold text-text-secondary">{t('communities.members')}</p>
                  <ul className="space-y-2">
                    {members.map((m) => (
                      <li key={m.id} className="flex items-center justify-between text-sm">
                        <span>
                          {m.username}
                          {m.flair && (
                            <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                              {m.flair}
                            </span>
                          )}
                          {m.is_creator && (
                            <span className="ml-2 rounded-full bg-vault/20 px-2 py-0.5 text-[10px] font-semibold text-vault">
                              {t('communities.creatorBadge')}
                            </span>
                          )}
                          {!m.is_creator && m.is_moderator && (
                            <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                              {t('communities.moderatorBadge')}
                            </span>
                          )}
                        </span>
                        {!m.is_creator && (
                          <span className="flex gap-2">
                            {isCreator && (
                              <button
                                type="button"
                                onClick={() => void handleToggleModerator(m.id, !m.is_moderator)}
                                className="rounded-lg bg-surface px-3 py-1 text-xs font-semibold text-text-secondary"
                              >
                                {m.is_moderator ? t('communities.removeModerator') : t('communities.makeModerator')}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleKick(m.id)}
                              className="rounded-lg bg-red-600/10 px-3 py-1 text-xs font-semibold text-red-600"
                            >
                              {t('communities.kick')}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleBan(m.id)}
                              className="rounded-lg bg-red-600/10 px-3 py-1 text-xs font-semibold text-red-600"
                            >
                              {t('communities.ban')}
                            </button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                {banned.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-text-secondary">{t('communities.bannedMembers')}</p>
                    <ul className="space-y-2">
                      {banned.map((b) => (
                        <li key={b.id} className="flex items-center justify-between text-sm">
                          <span>{b.username}</span>
                          <button
                            type="button"
                            onClick={() => void handleUnban(b.id)}
                            className="rounded-lg bg-surface px-3 py-1 text-xs font-semibold text-text-secondary"
                          >
                            {t('communities.unban')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {modQueueOpen && community.is_moderator && (
              <div className="mt-4 space-y-3 rounded-xl border border-surface bg-surface/30 p-4">
                <p className="text-xs font-semibold text-text-secondary">{t('communities.modQueue')}</p>
                {modQueue.length === 0 ? (
                  <p className="text-sm text-text-secondary">{t('communities.modQueueEmpty')}</p>
                ) : (
                  <ul className="space-y-3">
                    {modQueue.map((item) => (
                      <li key={item.id} className="rounded-lg border border-surface bg-background p-3 text-sm">
                        <p className="font-semibold text-text-primary">
                          @{item.post?.username || t('communities.unknownUser')}
                          {item.post?.flair && (
                            <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                              {item.post.flair}
                            </span>
                          )}
                        </p>
                        {item.post?.text && (
                          <p className="mt-1 text-text-secondary line-clamp-2">{item.post.text}</p>
                        )}
                        <p className="mt-2 text-xs text-text-secondary">
                          {item.reporter} · {item.status === 'pending' ? t('communities.modStatusPending') : item.status === 'auto_flagged' ? t('communities.modStatusAutoFlagged') : item.status}
                          {item.ai_flagged ? ' · AI' : ''}
                        </p>
                        {item.content && (
                          <p className="mt-1 text-xs text-text-secondary line-clamp-2">{item.content}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleModResolve(item.id, 'approve')}
                            className="rounded-full bg-surface px-3 py-1 text-[11px] font-semibold text-text-primary"
                          >
                            {t('communities.modApprove')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleModResolve(item.id, 'remove')}
                            className="rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-semibold text-red-500"
                          >
                            {t('communities.modRemove')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleModResolve(item.id, 'ban')}
                            className="rounded-full bg-red-500/20 px-3 py-1 text-[11px] font-semibold text-red-600"
                          >
                            {t('communities.modBan')}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </motion.div>

          <div className="mb-4 flex gap-2">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSort(opt.value)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                  sort === opt.value ? 'bg-vault text-white' : 'bg-surface text-text-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {community.is_member && !community.is_banned && (
            community.posting_permission === 'mods' && !community.is_moderator ? (
              <div className="card mb-6 p-4 text-sm text-text-secondary">
                {t('communities.postingLocked')}
              </div>
            ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card mb-6 p-4"
            >
              {community.flair_options?.length > 0 && (
                <select
                  value={postFlair}
                  onChange={(e) => setPostFlair(e.target.value)}
                  className="mb-3 w-full rounded-xl border border-surface bg-background px-4 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-vault/40"
                >
                  <option value="">{t('communities.noFlair')}</option>
                  {community.flair_options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                rows={3}
                placeholder={t('communities.postPlaceholder')}
                className="w-full resize-none rounded-xl border border-surface bg-background px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-vault/40"
              />
              {postError && <p className="mt-2 text-xs text-red-500">{postError}</p>}
              <div className="mt-3 flex items-center justify-between gap-2">
                {community.spoilers_enabled !== false ? (
                  <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={postSpoiler}
                      onChange={(e) => setPostSpoiler(e.target.checked)}
                    />
                    {t('communities.spoilerToggle')}
                  </label>
                ) : <span />}
                <button
                  type="button"
                  disabled={postBusy || !postText.trim()}
                  onClick={() => void handleCreatePost()}
                  className="rounded-full bg-vault px-5 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60"
                >
                  {t('communities.post')}
                </button>
              </div>
            </motion.div>
            )
          )}

          {mappedPosts.length === 0 ? (
            <EmptyState icon="💬" title={t('communities.emptyFeed')} />
          ) : (
            mappedPosts.map((post, idx) => (
              <motion.div
                key={post.id || idx}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.03 }}
                className="mb-6"
              >
                <PostCard {...post} onDeleted={load} onUpdated={load} />
              </motion.div>
            ))
          )}
        </>
      )}
    </AppShell>
  );
}
