'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowPathRoundedSquareIcon,
  LinkIcon,
  ShareIcon,
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  PhotoIcon,
  CodeBracketIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { useLocale } from './LocaleProvider';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { getUser } from '@/lib/auth';
import {
  buildEmbedCode,
  buildPlatformLinks,
  cosmicShareText,
  downloadShareCard,
  type ShareChannel,
  type ShareContentType,
} from '@/lib/shareUtils';
import {
  crossEchoPost,
  fetchMyCommunities,
  type Community,
} from '@/lib/communityApi';

interface ShareFriend {
  id: number;
  name: string;
}

interface ShareCosmicPanelProps {
  postId?: number;
  postUrl: string;
  postTitle?: string;
  shareCount?: number;
  contentType?: ShareContentType;
  authorName?: string;
  storyMediaUrl?: string | null;
  onShareToStory?: () => Promise<boolean>;
  onClose: () => void;
  onRecordShare?: (channel: ShareChannel) => void | Promise<void>;
  dmMessage?: string;
}

export default function ShareCosmicPanel({
  postId,
  postUrl,
  postTitle = 'Check this on Cosmory',
  shareCount = 0,
  contentType = 'post',
  authorName,
  storyMediaUrl,
  onShareToStory,
  onClose,
  onRecordShare,
  dmMessage,
}: ShareCosmicPanelProps) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [recordedChannels, setRecordedChannels] = useState<Set<ShareChannel>>(new Set());
  const [friends, setFriends] = useState<ShareFriend[]>([]);
  const [sendingTo, setSendingTo] = useState<number | null>(null);
  const [dmSent, setDmSent] = useState<number | null>(null);
  const [storyBusy, setStoryBusy] = useState(false);
  const [storyDone, setStoryDone] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [communitiesLoaded, setCommunitiesLoaded] = useState(false);
  const [crossEchoOpen, setCrossEchoOpen] = useState(false);
  const [crossEchoBusy, setCrossEchoBusy] = useState<number | null>(null);
  const [crossEchoDone, setCrossEchoDone] = useState<number | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [actionError, setActionError] = useState('');

  const shareText = useMemo(
    () => cosmicShareText(postTitle, contentType),
    [postTitle, contentType],
  );
  const platforms = useMemo(() => buildPlatformLinks(postUrl, shareText), [postUrl, shareText]);

  const trackShare = async (channel: ShareChannel) => {
    if (!recordedChannels.has(channel)) {
      setRecordedChannels((prev) => new Set(prev).add(channel));
      await onRecordShare?.(channel);
    }
  };

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  useEffect(() => {
    if (!actionError) return;
    const timer = setTimeout(() => setActionError(''), 3200);
    return () => clearTimeout(timer);
  }, [actionError]);

  useEffect(() => {
    if (!getUser()) return;
    void apiFetch('chat/friends/').then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data.friends) ? data.friends : [];
      setFriends(
        list.slice(0, 12).map((f: { id: number; name?: string; username?: string }) => ({
          id: f.id,
          name: f.name || f.username || 'Friend',
        })),
      );
    });
  }, []);

  useEffect(() => {
    if (!postId || contentType !== 'post' || !getUser()) return;
    let cancelled = false;
    setCommunitiesLoaded(false);
    void fetchMyCommunities().then((rows) => {
      if (cancelled) return;
      setCommunities(rows.filter((community) => community.is_member && !community.is_banned));
      setCommunitiesLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [contentType, postId]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const copyLink = async (channel: ShareChannel = 'copy') => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setActionError('');
      await trackShare(channel);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setActionError(t('feed.shareActionFailed'));
    }
  };

  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(buildEmbedCode(postUrl, postTitle.slice(0, 80)));
      setEmbedCopied(true);
      setActionError('');
      await trackShare('embed');
      setTimeout(() => setEmbedCopied(false), 2200);
    } catch {
      setActionError(t('feed.shareActionFailed'));
    }
  };

  const nativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: postTitle, text: shareText, url: postUrl });
        await trackShare('native');
        onClose();
      } catch {
        /* cancelled */
      }
    } else {
      void copyLink('copy');
    }
  };

  const shareToFriend = async (friendId: number) => {
    setSendingTo(friendId);
    const text = `${dmMessage || shareText}\n${postUrl}`;
    try {
      const res = await apiFetchJson('chat/send/', {
        method: 'POST',
        json: { peer_id: friendId, text },
      });
      if (res.ok) {
        setDmSent(friendId);
        setActionError('');
        await trackShare('dm');
      } else {
        setActionError(t('feed.shareActionFailed'));
      }
    } catch {
      setActionError(t('feed.shareActionFailed'));
    } finally {
      setSendingTo(null);
    }
  };

  const broadcastToStory = async () => {
    if (!onShareToStory || storyBusy) return;
    setStoryBusy(true);
    try {
      const ok = await onShareToStory();
      if (ok) {
        setStoryDone(true);
        setActionError('');
        await trackShare('story');
        setTimeout(() => setStoryDone(false), 2200);
      } else {
        setActionError(t('feed.shareActionFailed'));
      }
    } catch {
      setActionError(t('feed.shareActionFailed'));
    } finally {
      setStoryBusy(false);
    }
  };

  const saveShareCard = async () => {
    if (cardBusy) return;
    setCardBusy(true);
    try {
      const ok = await downloadShareCard(`cosmory-${contentType}.png`, {
        title: postTitle,
        subtitle: shareText,
        author: authorName,
      });
      if (ok) {
        setActionError('');
        await trackShare('card');
      } else {
        setActionError(t('feed.shareActionFailed'));
      }
    } catch {
      setActionError(t('feed.shareActionFailed'));
    } finally {
      setCardBusy(false);
    }
  };

  const sendCrossEcho = async (community: Community) => {
    if (!postId || crossEchoBusy) return;
    setCrossEchoBusy(community.id);
    try {
      const ok = await crossEchoPost(postId, community.id);
      if (ok) {
        setCrossEchoDone(community.id);
        setActionError('');
        setTimeout(() => {
          setCrossEchoDone(null);
          setCrossEchoOpen(false);
        }, 1200);
      } else {
        setActionError(`Could not Cross-Echo to ${community.name}.`);
      }
    } catch {
      setActionError(`Could not Cross-Echo to ${community.name}.`);
    } finally {
      setCrossEchoBusy(null);
    }
  };

  const canStory = Boolean(onShareToStory && storyMediaUrl && getUser());
  const canCrossEcho = Boolean(postId && communitiesLoaded && communities.length > 0);

  return (
    <motion.div
      className="cosmic-share-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('feed.shareTitle')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="cosmic-share-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="cosmic-share-sheet cosmic-share-sheet--wide"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      >
        <div className="cosmic-share-sheet__glow" aria-hidden />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full text-text-secondary hover:text-text hover:bg-surface/50 transition"
          aria-label={t('inspiration.close')}
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <div className="cosmic-share__bottle" aria-hidden>
          <motion.svg
            width="72"
            height="100"
            viewBox="0 0 100 200"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
          >
            <ellipse cx="50" cy="185" rx="14" ry="8" fill="url(#shareFlame)" opacity="0.8" />
            <defs>
              <radialGradient id="shareFlame">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#f97316" />
              </radialGradient>
              <linearGradient id="shareBody" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#6a00ff" />
              </linearGradient>
            </defs>
            <rect x="32" y="55" width="36" height="90" rx="18" fill="url(#shareBody)" />
            <ellipse cx="50" cy="95" rx="8" ry="9" fill="rgba(255,255,255,0.9)" />
            <ellipse cx="50" cy="42" rx="18" ry="10" fill="#c4b5fd" />
          </motion.svg>
        </div>

        <h2 className="cosmic-share-sheet__title">{t('feed.shareTitle')}</h2>
        <p className="cosmic-share-sheet__sub">
          {shareCount > 0 ? t('feed.shareCount', { count: String(shareCount) }) : ''}
          {t('feed.shareSubtitle')}
        </p>
        {actionError && (
          <p className="mt-1 text-xs font-medium text-red-400" role="alert">
            {actionError}
          </p>
        )}

        <div className="cosmic-share__copy-row">
          <input readOnly className="cosmic-share__url" value={postUrl} aria-label="Share link" />
          <button type="button" className="cosmic-share__copy-btn" onClick={() => void copyLink('copy')}>
            {copied ? t('feed.copied') : t('feed.copy')}
          </button>
        </div>

        <div className="cosmic-share__quick">
          {canStory && (
            <button
              type="button"
              className="cosmic-share__quick-btn"
              disabled={storyBusy}
              onClick={() => void broadcastToStory()}
            >
              <SparklesIcon className="h-5 w-5" />
              {storyDone ? t('feed.shareStoryDone') : storyBusy ? t('feed.shareStoryBusy') : t('feed.shareToStory')}
            </button>
          )}
          <button
            type="button"
            className="cosmic-share__quick-btn"
            disabled={cardBusy}
            onClick={() => void saveShareCard()}
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            {cardBusy ? t('feed.shareCardBusy') : t('feed.shareCard')}
          </button>
          <button type="button" className="cosmic-share__quick-btn" onClick={() => void copyEmbed()}>
            <CodeBracketIcon className="h-5 w-5" />
            {embedCopied ? t('feed.copied') : t('feed.shareEmbed')}
          </button>
          {canCrossEcho && (
            <button
              type="button"
              className="cosmic-share__quick-btn"
              onClick={() => setCrossEchoOpen(true)}
            >
              <ArrowPathRoundedSquareIcon className="h-5 w-5" />
              Cross-Echo
            </button>
          )}
          {storyMediaUrl && (
            <span className="cosmic-share__media-hint">
              <PhotoIcon className="h-4 w-4" />
              {t('feed.shareMediaHint')}
            </span>
          )}
        </div>

        {friends.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1">
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              {t('feed.shareToDm')}
            </p>
            <div className="flex flex-wrap gap-2">
              {friends.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  disabled={sendingTo === f.id}
                  className="text-xs rounded-full px-3 py-1.5 bg-surface hover:bg-vault/10 transition disabled:opacity-50"
                  onClick={() => void shareToFriend(f.id)}
                >
                  {dmSent === f.id ? '✓ ' : ''}
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="cosmic-share__platforms-label">{t('feed.sharePlatforms')}</p>
        <div className="cosmic-share__grid cosmic-share__grid--8">
          {platforms.map((p) => (
            <a
              key={p.id}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="cosmic-share__platform"
              style={{ borderColor: `${p.color}33` }}
              onClick={() => void trackShare(p.id)}
            >
              <span className="cosmic-share__platform-icon">{p.icon}</span>
              {p.name}
            </a>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void nativeShare()}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white border-0 cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #6a00ff, #0891b2)' }}
        >
          <ShareIcon className="h-5 w-5" />
          {canNativeShare ? t('feed.shareDevice') : t('feed.shareCopyInstead')}
        </button>
        <button
          type="button"
          onClick={() => void copyLink('copy')}
          className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text transition"
        >
          <LinkIcon className="h-4 w-4" />
          {t('feed.copyLinkOnly')}
        </button>

        {crossEchoOpen && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-4"
            onClick={() => setCrossEchoOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-3xl border border-surface bg-background p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-text">Cross-Echo to community</h3>
                  <p className="mt-1 text-xs text-text-secondary">
                    Pick one of your joined communities.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCrossEchoOpen(false)}
                  className="rounded-full p-1 text-text-secondary hover:bg-surface hover:text-text"
                  aria-label="Close Cross-Echo picker"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-2">
                {communities.map((community) => (
                  <button
                    key={community.id}
                    type="button"
                    disabled={crossEchoBusy != null}
                    onClick={() => void sendCrossEcho(community)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-left text-sm font-semibold text-text transition hover:bg-vault/10 disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{community.name}</span>
                      <span className="block truncate text-xs font-normal text-text-secondary">
                        c/{community.slug}
                      </span>
                    </span>
                    <span className="text-xs text-text-secondary">
                      {crossEchoDone === community.id
                        ? 'Sent'
                        : crossEchoBusy === community.id
                          ? 'Sending...'
                          : 'Echo'}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setCrossEchoOpen(false)}
                className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-text-secondary hover:bg-surface"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
