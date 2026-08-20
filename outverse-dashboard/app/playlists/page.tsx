'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PencilIcon, PlusIcon, QueueListIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { useLocale } from '@/components/LocaleProvider';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

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
  const confirm = useConfirm();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [videoId, setVideoId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPublic, setEditPublic] = useState(true);

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

  useEffect(() => {
    setEditing(false);
  }, [activeId]);

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

  const removeVideo = async (itemId: number) => {
    if (!activeId || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await apiFetchJson(`playlists/${activeId}/remove_item/`, {
        method: 'POST',
        json: { item_id: itemId },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || t('playlists.removeVideoFailed'));
      setMessage(t('playlists.videoRemoved'));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('playlists.removeVideoFailed'));
    } finally {
      setBusy(false);
    }
  };

  const startEditing = () => {
    if (!active) return;
    setEditTitle(active.title);
    setEditDescription(active.description || '');
    setEditPublic(Boolean(active.is_public));
    setEditing(true);
  };

  const saveEdits = async () => {
    if (!activeId || !editTitle.trim() || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await apiFetchJson(`playlists/${activeId}/`, {
        method: 'PATCH',
        json: { title: editTitle.trim(), description: editDescription.trim(), is_public: editPublic },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const fieldError = data ? Object.values(data)[0] : null;
        throw new Error(data?.detail || (Array.isArray(fieldError) ? fieldError[0] : fieldError) || t('playlists.editFailed'));
      }
      setEditing(false);
      setMessage(t('playlists.edited'));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('playlists.editFailed'));
    } finally {
      setBusy(false);
    }
  };

  const deletePlaylist = async () => {
    if (!activeId || busy) return;
    if (!(await confirm(t('playlists.deleteConfirm'), { danger: true, confirmLabel: t('playlists.delete') }))) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await apiFetch(`playlists/${activeId}/`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || t('playlists.deleteFailed'));
      }
      setActiveId(null);
      setEditing(false);
      setMessage(t('playlists.deleted'));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('playlists.deleteFailed'));
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
            {active ? editing ? (
              <div className="space-y-3">
                <input
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  placeholder={t('playlists.titlePlaceholder')}
                  className="w-full rounded-xl border border-surface bg-background px-3 py-2 text-sm"
                />
                <textarea
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  placeholder={t('playlists.descriptionPlaceholder')}
                  rows={2}
                  className="w-full rounded-xl border border-surface bg-background px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input type="checkbox" checked={editPublic} onChange={(event) => setEditPublic(event.target.checked)} />
                  {t('playlists.public')}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveEdits()}
                    disabled={busy || !editTitle.trim()}
                    className="rounded-xl bg-vault px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {t('playlists.save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-xl border border-surface px-4 py-2 text-sm font-semibold text-text-secondary"
                  >
                    {t('playlists.cancelEdit')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{active.title}</h2>
                    {active.description ? <p className="mt-1 text-sm text-text-secondary">{active.description}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={startEditing}
                      className="rounded-lg p-1.5 text-text-secondary hover:text-vault"
                      aria-label={t('playlists.editPlaylist')}
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deletePlaylist()}
                      className="rounded-lg p-1.5 text-text-secondary hover:text-red-500"
                      aria-label={t('playlists.deletePlaylist')}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
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
                      <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-surface bg-background/70 px-3 py-2">
                        {item.video ? (
                          <Link href={`/videos/${item.video.id}`} className="text-sm font-semibold hover:text-vault">
                            {item.video.title}
                          </Link>
                        ) : (
                          <span className="text-sm text-text-secondary">{t('playlists.videoUnavailable')}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => void removeVideo(item.id)}
                          disabled={busy}
                          className="shrink-0 rounded-lg p-1 text-text-secondary hover:text-red-500 disabled:opacity-50"
                          aria-label={t('playlists.removeVideo')}
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
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
