'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusIcon, QueueListIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { useLocale } from '@/components/LocaleProvider';

type PlaylistVideo = {
  id: number;
  title: string;
};

type PlaylistItem = {
  id: number;
  order?: number;
  video?: PlaylistVideo;
};

type Playlist = {
  id: number;
  title: string;
  description?: string;
  is_public?: boolean;
  items?: PlaylistItem[];
};

function listFromResponse(data: unknown): Playlist[] {
  if (Array.isArray(data)) return data as Playlist[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: Playlist[] }).results;
  }
  return [];
}

export default function PlaylistsPage() {
  const { t } = useLocale();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [videoId, setVideoId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('playlists/');
      if (!res.ok) throw new Error('failed');
      const rows = listFromResponse(await res.json());
      setPlaylists(rows);
      setActiveId((current) => current ?? rows[0]?.id ?? null);
    } catch {
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createPlaylist = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await apiFetchJson('playlists/', {
        method: 'POST',
        json: { title: title.trim(), description: description.trim(), is_public: isPublic },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const fieldError = data ? Object.values(data)[0] : null;
        throw new Error(data?.detail || (Array.isArray(fieldError) ? fieldError[0] : fieldError) || t('playlists.createFailed'));
      }
      const created = data as Playlist;
      setTitle('');
      setDescription('');
      setIsPublic(true);
      await load();
      setActiveId(created.id);
      setMessage(t('playlists.created'));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('playlists.createFailed'));
    } finally {
      setBusy(false);
    }
  };

  const addVideo = async () => {
    if (!activeId || !videoId.trim() || busy) return;
    const parsed = Number(videoId);
    if (!Number.isFinite(parsed)) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await apiFetchJson(`playlists/${activeId}/add_item/`, {
        method: 'POST',
        json: { video_id: parsed },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || data?.error || t('playlists.addVideoFailed'));
      setVideoId('');
      setMessage(t('playlists.videoAdded'));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('playlists.addVideoFailed'));
    } finally {
      setBusy(false);
    }
  };

  const active = playlists.find((playlist) => playlist.id === activeId) || null;

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-4xl mx-auto px-4 pb-16">
      <div className="pt-4 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <QueueListIcon className="h-7 w-7 text-vault" />
              {t('playlists.title')}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">{t('playlists.subtitle')}</p>
          </div>
          <Link href="/videos" className="rounded-full border border-surface px-4 py-2 text-sm font-semibold text-text-secondary hover:text-vault">
            {t('playlists.videosLink')}
          </Link>
        </header>

        <form onSubmit={createPlaylist} className="rounded-2xl border border-surface bg-surface/30 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-text-secondary">{t('playlists.create')}</h2>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('playlists.titlePlaceholder')}
            className="w-full rounded-xl border border-surface bg-background px-3 py-2 text-sm"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('playlists.descriptionPlaceholder')}
            rows={2}
            className="w-full rounded-xl border border-surface bg-background px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
              {t('playlists.public')}
            </label>
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-vault px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <PlusIcon className="h-4 w-4" />
              {t('playlists.create')}
            </button>
          </div>
        </form>

        {message ? <p className="text-sm text-text-secondary">{message}</p> : null}

        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-2">
            {loading ? (
              <p className="text-sm text-text-secondary">{t('playlists.loading')}</p>
            ) : playlists.length === 0 ? (
              <p className="rounded-2xl border border-surface bg-surface/20 p-4 text-sm text-text-secondary">
                {t('playlists.empty')}
              </p>
            ) : (
              playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => setActiveId(playlist.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    activeId === playlist.id ? 'border-vault bg-vault/10' : 'border-surface bg-surface/20'
                  }`}
                >
                  <p className="font-semibold">{playlist.title}</p>
                  <p className="text-xs text-text-secondary">
                    {t('playlists.videoCount', { count: playlist.items?.length ?? 0 })} - {playlist.is_public ? t('playlists.public') : t('playlists.private')}
                  </p>
                </button>
              ))
            )}
          </aside>

          <section className="rounded-2xl border border-surface bg-surface/20 p-4">
            {active ? (
              <>
                <h2 className="text-lg font-semibold">{active.title}</h2>
                {active.description ? <p className="mt-1 text-sm text-text-secondary">{active.description}</p> : null}
                <div className="mt-4 flex gap-2">
                  <input
                    value={videoId}
                    onChange={(event) => setVideoId(event.target.value)}
                    placeholder={t('playlists.videoIdPlaceholder')}
                    className="w-32 rounded-xl border border-surface bg-background px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void addVideo()}
                    disabled={busy || !videoId.trim()}
                    className="rounded-xl bg-vault px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {t('playlists.addVideo')}
                  </button>
                </div>
                <ul className="mt-4 space-y-2">
                  {(active.items || []).length === 0 ? (
                    <li className="text-sm text-text-secondary">{t('playlists.noVideos')}</li>
                  ) : (
                    active.items?.map((item) => (
                      <li key={item.id} className="rounded-xl border border-surface bg-background/70 px-3 py-2">
                        {item.video ? (
                          <Link href={`/videos/${item.video.id}`} className="text-sm font-semibold hover:text-vault">
                            {item.video.title}
                          </Link>
                        ) : (
                          <span className="text-sm text-text-secondary">{t('playlists.videoUnavailable')}</span>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              </>
            ) : (
              <p className="text-sm text-text-secondary">{t('playlists.selectOrCreate')}</p>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
