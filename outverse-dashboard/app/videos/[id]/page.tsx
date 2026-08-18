'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EyeIcon, ListBulletIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import CosmicVideoPlayer, { type CosmicVideoPlayerHandle } from '@/components/CosmicVideoPlayer';
import { apiFetch, apiFetchJson, mediaUrl } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { useLocale } from '@/components/LocaleProvider';

type Chapter = {
  id: number;
  title: string;
  start_seconds: number;
  order?: number;
};

type LongFormVideo = {
  id: number;
  title: string;
  description?: string;
  video?: string;
  thumbnail?: string | null;
  views?: number;
  chapters?: Chapter[];
  published_at?: string | null;
  premiere_at?: string | null;
  status?: string;
  is_premiere?: boolean;
  is_owner?: boolean;
  owner?: { id?: number };
  owner_id?: number;
  user?: { id?: number };
};

type Playlist = {
  id: number;
  title: string;
  is_public?: boolean;
};

function formatSeconds(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatPremiereCountdown(ms: number, soonLabel: string) {
  if (ms <= 0) return soonLabel;
  const totalSeconds = Math.ceil(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function listFromResponse(data: unknown): Playlist[] {
  if (Array.isArray(data)) return data as Playlist[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: Playlist[] }).results;
  }
  return [];
}

export default function VideoDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { t } = useLocale();
  const authUser = useAuthUser();
  const playerRef = useRef<CosmicVideoPlayerHandle>(null);
  const [video, setVideo] = useState<LongFormVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterStart, setChapterStart] = useState('');
  const [chapterBusy, setChapterBusy] = useState(false);
  const [chapterMessage, setChapterMessage] = useState('');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [playlistBusy, setPlaylistBusy] = useState(false);
  const [playlistMessage, setPlaylistMessage] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`videos/${id}/`);
      if (!res.ok) throw new Error('failed');
      setVideo((await res.json()) as LongFormVideo);
    } catch {
      setVideo(null);
      setError(t('videos.couldNotLoad'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!authUser) return;
    void (async () => {
      try {
        const res = await apiFetch('playlists/?mine=1');
        if (!res.ok) throw new Error('failed');
        const rows = listFromResponse(await res.json());
        setPlaylists(rows);
        setSelectedPlaylistId((current) => current || (rows[0]?.id ? String(rows[0].id) : ''));
      } catch {
        setPlaylists([]);
      }
    })();
  }, [authUser]);

  const isOwner = useMemo(() => {
    if (!video || !authUser) return false;
    if (video.is_owner) return true;
    const ownerId = video.owner?.id ?? video.owner_id ?? video.user?.id;
    return ownerId != null && String(ownerId) === String(authUser.id);
  }, [authUser, video]);

  const premiereAtMs = video?.premiere_at ? new Date(video.premiere_at).getTime() : null;
  const premiereInMs = premiereAtMs ? premiereAtMs - now : 0;
  const isPremierePending = !!video && (
    video.status === 'scheduled' ||
    (premiereAtMs != null && premiereInMs > 0) ||
    (!!video.is_premiere && !video.published_at)
  );

  const sortedChapters = useMemo(
    () => (video?.chapters || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.start_seconds - b.start_seconds),
    [video?.chapters],
  );

  const addChapter = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !chapterTitle.trim() || chapterBusy) return;
    const start = Number(chapterStart);
    if (!Number.isFinite(start) || start < 0) {
      setChapterMessage(t('videos.chapterStartError'));
      return;
    }
    setChapterBusy(true);
    setChapterMessage('');
    try {
      const res = await apiFetchJson(`videos/${id}/chapters/`, {
        method: 'POST',
        json: { title: chapterTitle.trim(), start_seconds: Math.floor(start) },
      });
      if (!res.ok) throw new Error('failed');
      const created = (await res.json()) as Chapter;
      setVideo((current) => current ? { ...current, chapters: [...(current.chapters || []), created] } : current);
      setChapterTitle('');
      setChapterStart('');
      setChapterMessage(t('videos.chapterAdded'));
    } catch {
      setChapterMessage(t('videos.couldNotAddChapter'));
    } finally {
      setChapterBusy(false);
    }
  };

  const addToPlaylist = async () => {
    if (!id || !selectedPlaylistId || playlistBusy) return;
    setPlaylistBusy(true);
    setPlaylistMessage('');
    try {
      const res = await apiFetchJson(`playlists/${selectedPlaylistId}/add_item/`, {
        method: 'POST',
        json: { video_id: Number(id) },
      });
      if (!res.ok) throw new Error('failed');
      setPlaylistMessage(t('videos.addedToPlaylist'));
    } catch {
      setPlaylistMessage(t('videos.couldNotAddToPlaylist'));
    } finally {
      setPlaylistBusy(false);
    }
  };

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-4xl mx-auto px-4 pb-16">
      <div className="pt-4">
        <Link href="/videos" className="text-sm font-semibold text-vault hover:underline">
          {t('videos.backToVideos')}
        </Link>

        {loading ? (
          <p className="py-16 text-center text-sm text-text-secondary">{t('videos.loadingVideo')}</p>
        ) : error || !video ? (
          <p className="py-16 text-center text-sm text-text-secondary">{error || t('videos.notFound')}</p>
        ) : (
          <article className="mt-4 space-y-5">
            {isPremierePending ? (
              <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-vault/30 bg-gradient-to-br from-vault/20 via-surface/50 to-bazaar/20 px-6 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-vault">{t('videos.premiereLabel')}</p>
                <p className="mt-2 text-2xl font-bold">
                  {premiereAtMs ? t('videos.premiereIn', { countdown: formatPremiereCountdown(premiereInMs, t('videos.premiereSoon')) }) : t('videos.premiereScheduled')}
                </p>
                <p className="mt-2 max-w-md text-sm text-text-secondary">
                  {t('videos.premiereUnlockHint')}
                </p>
              </div>
            ) : video.video ? (
              <CosmicVideoPlayer
                ref={playerRef}
                src={mediaUrl(video.video)}
                poster={video.thumbnail ? mediaUrl(video.thumbnail) : undefined}
                className="aspect-video"
                style={{ maxHeight: 560 }}
              />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-2xl border border-surface bg-surface/40 text-sm text-text-secondary">
                {t('videos.fileUnavailable')}
              </div>
            )}

            <header className="rounded-2xl border border-surface bg-surface/30 p-4">
              <h1 className="text-2xl font-bold">{video.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                <span className="inline-flex items-center gap-1">
                  <EyeIcon className="h-4 w-4" />
                  {video.views ?? 0} {t('videos.views')}
                </span>
                {video.published_at ? <span>{t('videos.published', { date: new Date(video.published_at).toLocaleString() })}</span> : null}
                {video.premiere_at ? <span>{t('videos.premiereAt', { date: new Date(video.premiere_at).toLocaleString() })}</span> : null}
                {video.status ? <span className="capitalize">{video.status}</span> : null}
              </div>
              {video.description ? (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{video.description}</p>
              ) : null}
            </header>

            {authUser ? (
              <section className="rounded-2xl border border-surface bg-surface/20 p-4">
                <h2 className="text-sm font-semibold text-text-secondary">{t('videos.addToPlaylist')}</h2>
                {playlists.length === 0 ? (
                  <p className="mt-2 text-sm text-text-secondary">
                    {t('videos.noPlaylists')} <Link href="/playlists" className="font-semibold text-vault hover:underline">{t('videos.createOne')}</Link>.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select
                      value={selectedPlaylistId}
                      onChange={(event) => setSelectedPlaylistId(event.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-surface bg-background px-3 py-2 text-sm"
                    >
                      {playlists.map((playlist) => (
                        <option key={playlist.id} value={playlist.id}>
                          {playlist.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void addToPlaylist()}
                      disabled={playlistBusy || !selectedPlaylistId}
                      className="rounded-xl bg-vault px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {playlistBusy ? t('videos.adding') : t('videos.addItem')}
                    </button>
                  </div>
                )}
                {playlistMessage ? <p className="mt-2 text-xs text-text-secondary">{playlistMessage}</p> : null}
              </section>
            ) : null}

            <section className="rounded-2xl border border-surface bg-surface/20 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                  <ListBulletIcon className="h-5 w-5" />
                  {t('videos.chapters')}
                </h2>
                {isOwner ? (
                  <form onSubmit={addChapter} className="flex flex-wrap gap-2">
                    <input
                      value={chapterTitle}
                      onChange={(event) => setChapterTitle(event.target.value)}
                      placeholder={t('videos.chapterTitlePlaceholder')}
                      className="w-40 rounded-xl border border-surface bg-background px-3 py-2 text-sm"
                    />
                    <input
                      value={chapterStart}
                      onChange={(event) => setChapterStart(event.target.value)}
                      placeholder={t('videos.secondsPlaceholder')}
                      inputMode="numeric"
                      className="w-24 rounded-xl border border-surface bg-background px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={chapterBusy || !chapterTitle.trim() || !chapterStart.trim()}
                      className="rounded-xl bg-vault px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {chapterBusy ? t('videos.adding') : t('videos.add')}
                    </button>
                  </form>
                ) : null}
              </div>
              {chapterMessage ? <p className="mb-3 text-xs text-text-secondary">{chapterMessage}</p> : null}
              {sortedChapters.length === 0 ? (
                <p className="text-sm text-text-secondary">{t('videos.noChapters')}</p>
              ) : (
                <ol className="space-y-2">
                  {sortedChapters.map((chapter) => (
                    <li key={chapter.id}>
                      <button
                        type="button"
                        onClick={() => playerRef.current?.seekTo(chapter.start_seconds, { play: true })}
                        disabled={isPremierePending || !video.video}
                        className="flex w-full items-center justify-between rounded-xl bg-background/70 px-3 py-2 text-left transition hover:bg-vault/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="text-sm font-medium">{chapter.title}</span>
                        <span className="text-xs tabular-nums text-text-secondary">{formatSeconds(chapter.start_seconds)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </article>
        )}
      </div>
    </AppShell>
  );
}
