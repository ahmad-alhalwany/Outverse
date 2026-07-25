'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CloudArrowUpIcon, PlayCircleIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import { apiFetch, apiFetchJson, mediaUrl } from '@/lib/api';

type VideoUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type LongFormVideo = {
  id: number;
  user?: VideoUser | null;
  title: string;
  description?: string;
  video?: string;
  thumbnail?: string | null;
  status?: string;
  premiere_at?: string | null;
  published_at?: string | null;
  views?: number;
};

function listFromResponse(data: unknown): LongFormVideo[] {
  if (Array.isArray(data)) return data as LongFormVideo[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: LongFormVideo[] }).results;
  }
  return [];
}

function creatorName(user?: VideoUser | null) {
  if (!user) return 'Creator';
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return full || user.username || 'Creator';
}

export default function VideosPage() {
  const [videos, setVideos] = useState<LongFormVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [premiereAt, setPremiereAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('videos/');
      if (!res.ok) throw new Error('failed');
      setVideos(listFromResponse(await res.json()));
    } catch {
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !file || submitting) return;
    setSubmitting(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('description', description.trim());
      form.append('video', file);
      form.append('visibility', 'public');
      form.append('status', premiereAt ? 'scheduled' : 'published');
      const createdRes = await apiFetch('videos/', { method: 'POST', body: form });
      if (!createdRes.ok) throw new Error('upload failed');
      const created = (await createdRes.json()) as LongFormVideo;
      if (premiereAt) {
        const iso = new Date(premiereAt).toISOString();
        const premiereRes = await apiFetchJson(`videos/${created.id}/premiere/`, {
          method: 'POST',
          json: { premiere_at: iso },
        });
        if (!premiereRes.ok) throw new Error('premiere failed');
      } else {
        await apiFetchJson(`videos/${created.id}/publish/`, { method: 'POST', json: {} });
      }
      setTitle('');
      setDescription('');
      setPremiereAt('');
      setFile(null);
      setMessage('Video uploaded.');
      await loadVideos();
    } catch {
      setMessage('Could not upload video. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-4xl mx-auto px-4 pb-16">
      <div className="pt-4 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <PlayCircleIcon className="h-7 w-7 text-vault" />
              Creator Videos
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Upload long-form videos, schedule premieres, and browse published creator drops.
            </p>
          </div>
          <Link href="/playlists" className="rounded-full border border-surface px-4 py-2 text-sm font-semibold text-text-secondary hover:text-vault">
            Playlists
          </Link>
        </header>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-surface bg-surface/30 p-4 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <CloudArrowUpIcon className="h-5 w-5" />
            Upload video
          </h2>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            className="w-full rounded-xl border border-surface bg-background px-3 py-2 text-sm"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description"
            rows={3}
            className="w-full rounded-xl border border-surface bg-background px-3 py-2 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-text-secondary">
              Video file
              <input
                type="file"
                accept="video/*"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="mt-1 w-full rounded-xl border border-surface bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-text-secondary">
              Optional premiere
              <input
                type="datetime-local"
                value={premiereAt}
                onChange={(event) => setPremiereAt(event.target.value)}
                className="mt-1 w-full rounded-xl border border-surface bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="flex items-center justify-between gap-3">
            {message ? <p className="text-xs text-text-secondary">{message}</p> : <span />}
            <button
              type="submit"
              disabled={submitting || !title.trim() || !file}
              className="rounded-xl bg-vault px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-text-secondary">Published videos</h2>
          {loading ? (
            <p className="py-10 text-center text-sm text-text-secondary">Loading videos...</p>
          ) : videos.length === 0 ? (
            <p className="rounded-2xl border border-surface bg-surface/20 p-6 text-center text-sm text-text-secondary">
              No published videos yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {videos.map((video) => (
                <Link
                  key={video.id}
                  href={`/videos/${video.id}`}
                  className="group overflow-hidden rounded-2xl border border-surface bg-surface/30 transition hover:-translate-y-0.5 hover:border-vault/40"
                >
                  <div
                    className="aspect-video bg-cover bg-center"
                    style={{
                      backgroundImage: video.thumbnail
                        ? `url(${mediaUrl(video.thumbnail)})`
                        : 'linear-gradient(135deg, rgba(124,58,237,0.5), rgba(34,211,238,0.28))',
                    }}
                  >
                    <div className="flex h-full items-center justify-center bg-black/10 text-white">
                      <PlayCircleIcon className="h-12 w-12 drop-shadow transition group-hover:scale-105" />
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-text">{video.title}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {creatorName(video.user)} - {video.views ?? 0} views
                    </p>
                    {video.premiere_at ? (
                      <p className="mt-2 text-xs font-medium text-vault">
                        Premieres {new Date(video.premiere_at).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
