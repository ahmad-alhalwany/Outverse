'use client';

import Image from 'next/image';


import { useCallback, useEffect, useRef, useState } from 'react';

import Link from 'next/link';

import { motion, AnimatePresence } from 'framer-motion';

import {
  BookmarkIcon,
  ChatBubbleLeftIcon,
  EyeIcon,
  FlagIcon,
  HeartIcon,
  PencilSquareIcon,
  ShareIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';

import { apiFetch, apiFetchJson, mediaUrl } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { reelPageUrl } from '@/lib/fetchReel';
import {
  enforceTrimLoop,
  musicTrimFromReel,
  trimmedAudioTime,
} from '@/lib/reelMusicTrim';
import {
  REEL_FILTER_META,
  REEL_MOOD_META,
  reelAuthorName,
  reelMusicPlaybackUrl,
  type ReelFilter,
  type ReelItem,
} from '@/lib/reelTypes';

import RelativeTime from '@/components/RelativeTime';

import { useLocale } from '../LocaleProvider';

import ShareCosmicPanel from '../ShareCosmicPanel';
import ReelCommentsSheet from './ReelCommentsSheet';

interface ReelSlideProps {
  reel: ReelItem;
  active: boolean;
  onLike: (id: number) => Promise<{ liked: boolean; likes_count: number } | null>;
  onView: (id: number) => void;
  onDeleted?: () => void;
  onSavedChange?: (id: number, saved: boolean) => void;
}

export default function ReelSlide({ reel, active, onLike, onView, onDeleted, onSavedChange }: ReelSlideProps) {

  const { t } = useLocale();

  const videoRef = useRef<HTMLVideoElement>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  const [liked, setLiked] = useState(reel.is_liked);

  const [likes, setLikes] = useState(reel.likes_count);

  const [commentsCount, setCommentsCount] = useState(reel.comments_count);
  const [saved, setSaved] = useState(Boolean(reel.is_saved));

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [muted, setMuted] = useState(true);

  const [burst, setBurst] = useState(0);

  const [likePop, setLikePop] = useState(false);

  const [progress, setProgress] = useState(0);

  const [paused, setPaused] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(reel.caption || '');
  const [tagsDraft, setTagsDraft] = useState((reel.tags || []).join(', '));
  const [filterDraft, setFilterDraft] = useState<ReelFilter>((reel.filter_style || 'none') as ReelFilter);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const viewedRef = useRef(false);
  const progressFrameRef = useRef<number | null>(null);

  const lastTap = useRef(0);



  const mood = REEL_MOOD_META[reel.mood] || REEL_MOOD_META.cosmic;

  const filterKey = (reel.filter_style || 'none') as ReelFilter;

  const filterMeta = REEL_FILTER_META[filterKey] || REEL_FILTER_META.none;

  const avatar = reel.user.avatar ? mediaUrl(reel.user.avatar) : '';

  const musicUrl = reelMusicPlaybackUrl(reel);
  const hasOverlayMusic = !!musicUrl;
  const musicTrim = musicTrimFromReel(reel);
  const me = getUser();
  const isOwner = me?.id === reel.user.id;



  useEffect(() => {

    setLiked(reel.is_liked);

    setLikes(reel.likes_count);

    setCommentsCount(reel.comments_count);
    setSaved(Boolean(reel.is_saved));

    setProgress(0);
    setCaptionDraft(reel.caption || '');
    setTagsDraft((reel.tags || []).join(', '));
    setFilterDraft((reel.filter_style || 'none') as ReelFilter);
    setEditError('');

  }, [reel.id, reel.is_liked, reel.likes_count, reel.comments_count, reel.is_saved]);



  const syncPlayback = useCallback(

    (play: boolean) => {

      const v = videoRef.current;

      const a = audioRef.current;

      if (v) {

        if (play) v.play().catch(() => {});

        else {

          v.pause();

          v.currentTime = 0;

        }

        if (hasOverlayMusic) v.muted = true;

        else v.muted = muted;

      }

      if (a && hasOverlayMusic) {

        a.muted = muted;

        if (play) {
          if (v && a.duration && Number.isFinite(a.duration)) {
            a.currentTime = trimmedAudioTime(
              v.currentTime,
              musicTrim,
              a.duration,
            );
          }
          a.play().catch(() => {});
        } else {
          a.pause();
          a.currentTime = musicTrim.start;
        }

      }

      setPaused(!play);

    },

    [hasOverlayMusic, muted, musicTrim],

  );



  useEffect(() => {

    if (active) {

      syncPlayback(true);

      if (!viewedRef.current) {

        viewedRef.current = true;

        onView(reel.id);

      }

    } else {

      syncPlayback(false);

    }

  }, [active, reel.id, onView, syncPlayback]);



  useEffect(() => {

    const v = videoRef.current;

    const a = audioRef.current;

    if (!v || !active) return;

    const alignAudio = () => {
      if (!a || !hasOverlayMusic || !a.duration || !Number.isFinite(a.duration)) return;
      enforceTrimLoop(a, musicTrim);
      const target = trimmedAudioTime(v.currentTime, musicTrim, a.duration);
      if (Math.abs(a.currentTime - target) > 0.35) {
        a.currentTime = target;
      }
    };

    const onTime = () => {
      if (v.duration && Number.isFinite(v.duration) && progressFrameRef.current == null) {
        progressFrameRef.current = window.requestAnimationFrame(() => {
          setProgress((v.currentTime / v.duration) * 100);
          progressFrameRef.current = null;
        });
      }

      alignAudio();

    };

    const onPlay = () => {

      setPaused(false);

      if (a && hasOverlayMusic) {

        alignAudio();

        a.muted = muted;

        a.play().catch(() => {});

      }

    };

    const onPause = () => {

      setPaused(true);

      if (a && hasOverlayMusic) a.pause();

    };

    v.addEventListener('timeupdate', onTime);

    v.addEventListener('play', onPlay);

    v.addEventListener('pause', onPause);

    return () => {
      if (progressFrameRef.current != null) {
        window.cancelAnimationFrame(progressFrameRef.current);
        progressFrameRef.current = null;
      }

      v.removeEventListener('timeupdate', onTime);

      v.removeEventListener('play', onPlay);

      v.removeEventListener('pause', onPause);

    };

  }, [active, reel.id, hasOverlayMusic, muted, musicTrim]);



  useEffect(() => {

    const v = videoRef.current;

    const a = audioRef.current;

    if (v && !hasOverlayMusic) v.muted = muted;

    if (a && hasOverlayMusic) a.muted = muted;

  }, [muted, hasOverlayMusic]);



  const toggleLike = useCallback(async () => {

    const res = await onLike(reel.id);

    if (res) {

      setLiked(res.liked);

      setLikes(res.likes_count);

      if (res.liked) {

        setLikePop(true);

        setTimeout(() => setLikePop(false), 700);

      }

    }

  }, [onLike, reel.id]);



  const onVideoTap = () => {

    const now = Date.now();

    if (now - lastTap.current < 320) {

      toggleLike();

      setBurst((b) => b + 1);

    } else {

      const v = videoRef.current;

      if (v) {

        if (v.paused) syncPlayback(true);

        else syncPlayback(false);

      }

    }

    lastTap.current = now;

  };



  const soundLabel =

    reel.music_track_detail?.title ||

    reel.sound_label ||

    t('reels.originalSound');



  const reportReel = async () => {
    if (!me || isOwner) return;
    if (!window.confirm(t('reels.confirmReportReel'))) return;
    try {
      const res = await apiFetchJson('moderation/flagged/', {
        method: 'POST',
        json: {
          type: 'reel',
          content: `reel:${reel.id} @${reelAuthorName(reel.user)}: ${(reel.caption || '').slice(0, 200)}`,
          reporter: me.username,
        },
      });
      if (res.ok) {
        window.alert('Report submitted successfully.');
      }
    } catch {
      /* ignore */
    }
  };

  const toggleSave = async () => {
    if (!me) return;
    try {
      const res = await apiFetchJson(`reels/${reel.id}/save/`, { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      const nextSaved = Boolean(data.saved);
      setSaved(nextSaved);
      onSavedChange?.(reel.id, nextSaved);
    } catch {
      /* ignore */
    }
  };

  const deleteReel = async () => {
    if (!me || !isOwner) return;
    if (!window.confirm(t('reels.confirmDeleteReel'))) return;
    try {
      const res = await apiFetch(`reels/${reel.id}/`, { method: 'DELETE' });
      if (res.ok) onDeleted?.();
    } catch {
      /* ignore */
    }
  };

  const saveEdit = async () => {
    if (!me || !isOwner) return;
    setSavingEdit(true);
    setEditError('');
    try {
      const res = await apiFetchJson(`reels/${reel.id}/`, {
        method: 'PATCH',
        json: {
          caption: captionDraft.trim(),
          tags: tagsDraft
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          filter_style: filterDraft,
        },
      });
      if (!res.ok) throw new Error('failed');
      window.location.reload();
    } catch {
      setEditError(t('reels.updateFailed'));
    } finally {
      setSavingEdit(false);
    }
  };

  const formatCount = (n: number) => {

    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;

    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;

    return n > 0 ? String(n) : '—';

  };



  return (

    <section

      className={`reel-slide reel-slide--filter-${filterKey}${active ? ' reel-slide--active' : ''}`}

      data-mood={reel.mood}

      style={{ '--reel-hue': mood.hue } as React.CSSProperties}

    >

      <div className="reel-slide__viewport">

        <div className="reel-slide__frame">

          <div className="reel-slide__warp" aria-hidden />

          <div className="reel-slide__scanlines" aria-hidden />

          {filterKey === 'glitch' && <div className="reel-slide__glitch-layer" aria-hidden />}



          {active && (

            <div className="reel-slide__progress" aria-hidden>

              <span className="reel-slide__progress-fill" style={{ width: `${progress}%` }} />

            </div>

          )}



          <video

            ref={videoRef}

            className="reel-slide__video"

            src={mediaUrl(reel.video) || reel.video}

            style={{ filter: filterMeta.css || undefined }}

            loop

            playsInline

            muted

            onClick={onVideoTap}

          />

          {musicUrl && <audio ref={audioRef} src={musicUrl} loop playsInline />}



          <div className="reel-slide__vignette" aria-hidden />

          {!reel.is_active && isOwner && (
            <div
              className="absolute left-4 right-4 top-4 rounded-2xl px-4 py-3 text-sm font-medium"
              style={{
                background: 'rgba(255, 196, 0, 0.18)',
                border: '1px solid rgba(255, 196, 0, 0.35)',
                color: '#fff',
              }}
            >
              This signal is hidden from public feeds due to moderation state.
            </div>
          )}



          {active && paused && (

            <div className="reel-slide__pause-hint" aria-hidden>

              <span className="reel-slide__pause-icon">▶</span>

            </div>

          )}



          <AnimatePresence>

            {likePop && (

              <motion.div

                className="reel-slide__like-burst"

                initial={{ scale: 0.4, opacity: 0 }}

                animate={{ scale: 1.2, opacity: 1 }}

                exit={{ scale: 1.6, opacity: 0 }}

                key={burst}

              >

                <HeartSolid className="h-24 w-24 text-pink-400 drop-shadow-lg" />

              </motion.div>

            )}

          </AnimatePresence>



          {reel.views > 0 && (

            <div className="reel-slide__views">

              <EyeIcon className="h-3.5 w-3.5" />

              <span>{formatCount(reel.views)}</span>

            </div>

          )}

        </div>

      </div>



      <div className="reel-slide__side">

        <Link href={`/profile/${reel.user.id}`} className="reel-slide__avatar-link">

          <span className="reel-slide__avatar-ring">

            {avatar ? (

              // eslint-disable-next-line @next/next/no-img-element

              <Image src={avatar} alt={`${reelAuthorName(reel.user)} avatar`} width={56} height={56} className="reel-slide__avatar" unoptimized />

            ) : (

              <span className="reel-slide__avatar-fallback">{mood.emoji}</span>

            )}

          </span>

        </Link>

        <button

          type="button"

          className={`reel-slide__action${saved ? ' reel-slide__action--liked' : ''}`}

          onClick={toggleSave}

          aria-label="Save reel"

        >

          <BookmarkIcon className="h-7 w-7" />

          <span>{saved ? 'Saved' : 'Save'}</span>

        </button>



        <button

          type="button"

          className={`reel-slide__action${liked ? ' reel-slide__action--liked' : ''}`}

          onClick={toggleLike}

          aria-pressed={liked}

        >

          {liked ? (

            <HeartSolid className="h-7 w-7 text-pink-400" />

          ) : (

            <HeartIcon className="h-7 w-7" />

          )}

          <span>{formatCount(likes)}</span>

        </button>



        <button

          type="button"

          className="reel-slide__action"

          onClick={() => setCommentsOpen(true)}

          aria-label={t('reels.commentsTitle')}

        >

          <ChatBubbleLeftIcon className="h-7 w-7" />

          <span>{formatCount(commentsCount)}</span>

        </button>



        <button type="button" className="reel-slide__action" onClick={() => setShareOpen(true)}>
          <ShareIcon className="h-7 w-7" />
          <span>{t('reels.share')}</span>
        </button>



        <button
          type="button"
          className="reel-slide__action"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? t('reels.unmute') : t('reels.mute')}
        >
          {muted ? <SpeakerXMarkIcon className="h-7 w-7" /> : <SpeakerWaveIcon className="h-7 w-7" />}
        </button>

        {isOwner ? (
          <>
            <button
              type="button"
              className="reel-slide__action"
              onClick={() => setEditOpen(true)}
              aria-label={t('reels.editReel')}
            >
              <PencilSquareIcon className="h-7 w-7" />
              <span>{t('reels.editReel')}</span>
            </button>
            <button
              type="button"
              className="reel-slide__action reel-slide__action--danger"
              onClick={deleteReel}
              aria-label={t('reels.deleteReel')}
            >
              <TrashIcon className="h-7 w-7" />
              <span>{t('reels.deleteReel')}</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            className="reel-slide__action"
            onClick={reportReel}
            aria-label={t('reels.reportReel')}
          >
            <FlagIcon className="h-7 w-7" />
            <span>{t('reels.reportReel')}</span>
          </button>
        )}
      </div>



      <div className="reel-slide__meta">

        <div className="reel-slide__chips">

          <span className="reel-slide__mood-chip">

            <span>{mood.emoji}</span>

            <span>{mood.label}</span>

          </span>

          {filterKey !== 'none' && (

            <span className="reel-slide__filter-chip">

              {filterMeta.emoji} {filterMeta.label}

            </span>

          )}

        </div>

        <Link href={`/profile/${reel.user.id}`} className="reel-slide__author">

          @{reelAuthorName(reel.user)}

        </Link>

        {reel.caption && <p className="reel-slide__caption">{reel.caption}</p>}

        {reel.tags && reel.tags.length > 0 && (

          <div className="reel-slide__tags">

            {reel.tags.slice(0, 4).map((tag) => (

              <Link

                key={tag}

                href={`/reels?tag=${encodeURIComponent(tag)}`}

                className="reel-slide__tag"

              >

                #{tag}

              </Link>

            ))}

          </div>

        )}

        <div className="reel-slide__sound">

          <span className="reel-slide__sound-wave" aria-hidden />

          <span className="reel-slide__sound-marquee">

            <span>{soundLabel}</span>

          </span>

        </div>

        <RelativeTime date={reel.created_at} className="reel-slide__time block" />

        {active && (

          <p className="reel-slide__hint">{t('reels.doubleTap')}</p>

        )}

      </div>



      <ReelCommentsSheet
        reelId={reel.id}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCountChange={setCommentsCount}
      />

      <AnimatePresence>
        {shareOpen && (
          <ShareCosmicPanel
            postUrl={reelPageUrl(reel.id)}
            postTitle={reel.caption?.slice(0, 80) || t('reels.shareSignalTitle')}
            onClose={() => setShareOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{ background: 'rgba(10,10,34,0.72)', backdropFilter: 'blur(4px)' }}
            onClick={() => setEditOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl p-6"
              style={{ background: 'rgba(20,20,40,0.96)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <h3 className="text-lg font-semibold text-white mb-4">{t('reels.editTitle')}</h3>
              <label className="block text-sm text-white/70 mb-1">{t('reels.captionLabel')}</label>
              <textarea
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                rows={3}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none bg-white/5 text-white border border-white/10"
              />
              <label className="block text-sm text-white/70 mt-4 mb-1">
                {t('reels.tagsLabel')} · {t('reels.tagsHint')}
              </label>
              <input
                value={tagsDraft}
                onChange={(e) => setTagsDraft(e.target.value)}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none bg-white/5 text-white border border-white/10"
              />
              <label className="block text-sm text-white/70 mt-4 mb-1">{t('reels.filterLabel')}</label>
              <select
                value={filterDraft}
                onChange={(e) => setFilterDraft(e.target.value as ReelFilter)}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none bg-white/5 text-white border border-white/10"
              >
                {Object.entries(REEL_FILTER_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
              {editError ? <p className="text-sm text-red-300 mt-3">{editError}</p> : null}
              <div className="flex gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white bg-white/10"
                >
                  {t('common.close')}
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(90deg, #6a00ff, #a855f7)' }}
                >
                  {savingEdit ? t('reels.savingReel') : t('reels.saveReel')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>

  );

}

