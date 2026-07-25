'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PlusIcon, SignalIcon, EyeIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import { useLocale } from '@/components/LocaleProvider';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { fetchLiveSessions, createSession, type LiveSession, type CreateSessionPayload } from '@/lib/liveApi';

const DEFAULT_FORM: CreateSessionPayload = {
  title: '',
  description: '',
  is_public: true,
  chat_enabled: true,
};

function LiveBadge({ session, t }: { session: LiveSession; t: (k: string) => string }) {
  if (session.status === 'live') {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-red-500/90 px-2.5 py-1 text-xs font-bold text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        {t('live.statusLive')}
      </span>
    );
  }
  if (session.status === 'scheduled') {
    return (
      <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: '#94a3b822', color: '#94a3b8' }}>
        {t('live.statusScheduled')}
      </span>
    );
  }
  return (
    <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: '#94a3b822', color: '#94a3b8' }}>
      {t('live.statusEnded')}
    </span>
  );
}

function SessionCard({ session, t }: { session: LiveSession; t: (k: string) => string }) {
  return (
    <Link
      href={`/live/${session.id}`}
      className="block rounded-2xl border p-4 transition hover:opacity-90"
      style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)' }}
    >
      <div className="mb-3 flex aspect-video items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--c-focus)33, transparent)' }}>
        <SignalIcon className="h-10 w-10" style={{ color: 'var(--c-focus)' }} />
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold" style={{ color: 'rgb(var(--c-text))' }}>{session.title}</p>
          <p className="truncate text-xs" style={{ color: 'rgb(var(--c-text-secondary))' }}>{session.user}</p>
        </div>
        <LiveBadge session={session} t={t} />
      </div>
      {session.status === 'live' && (
        <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'rgb(var(--c-text-secondary))' }}>
          <EyeIcon className="h-3.5 w-3.5" />
          {session.current_viewers.toLocaleString()} {t('live.watching')}
        </div>
      )}
    </Link>
  );
}

export default function LiveHubPage() {
  const { t } = useLocale();
  const user = useAuthUser();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CreateSessionPayload>(DEFAULT_FORM);

  async function load() {
    setLoading(true);
    const data = await fetchLiveSessions();
    setSessions(data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const liveNow = useMemo(() => sessions.filter((s) => s.status === 'live'), [sessions]);
  const mine = useMemo(
    () => (user ? sessions.filter((s) => s.user === user.username) : []),
    [sessions, user],
  );
  const scheduled = useMemo(
    () => sessions.filter((s) => s.status === 'scheduled' && s.user !== user?.username),
    [sessions, user],
  );

  async function handleCreate() {
    if (!form.title.trim()) {
      setError(t('live.createError'));
      return;
    }
    setCreating(true);
    setError('');
    const res = await createSession(form);
    setCreating(false);
    if (!res.ok || !('id' in res.data)) {
      setError(t('live.createError'));
      return;
    }
    window.location.href = `/live/${(res.data as LiveSession).id}`;
  }

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-3xl mx-auto px-4 pb-12">
      <section className="mb-6 mt-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'rgb(var(--c-text))' }}>
              {t('live.title')}
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>
              {t('live.subtitle')}
            </p>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white"
              style={{ background: 'var(--c-focus)' }}
            >
              <PlusIcon className="h-4 w-4" />
              {t('live.goLive')}
            </button>
          )}
        </div>
      </section>

      {showForm && (
        <section className="mb-6 rounded-[28px] border p-6 space-y-4" style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)' }}>
          <h2 className="text-[1.05rem] font-semibold" style={{ color: 'rgb(var(--c-text))' }}>{t('live.createTitle')}</h2>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'rgb(var(--c-text))' }}>{t('live.streamTitle')}</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-sm"
              style={{ background: 'rgb(var(--c-surface))', color: 'rgb(var(--c-text))', border: '1px solid var(--c-border)' }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'rgb(var(--c-text))' }}>{t('live.descriptionLabel')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full rounded-xl px-3 py-2 text-sm"
              style={{ background: 'rgb(var(--c-surface))', color: 'rgb(var(--c-text))', border: '1px solid var(--c-border)' }}
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm" style={{ color: 'rgb(var(--c-text))' }}>
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
              />
              {t('live.isPublic')}
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'rgb(var(--c-text))' }}>
              <input
                type="checkbox"
                checked={form.chat_enabled}
                onChange={(e) => setForm((f) => ({ ...f, chat_enabled: e.target.checked }))}
              />
              {t('live.chatEnabledLabel')}
            </label>
          </div>
          {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={creating}
              onClick={() => void handleCreate()}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--c-focus)' }}
            >
              {creating ? t('live.creating') : t('live.create')}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(''); }}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold"
              style={{ color: 'var(--c-icon)' }}
            >
              {t('live.cancel')}
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>{t('common.loading')}</p>
      ) : (
        <>
          {user && mine.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-[1.05rem] font-semibold" style={{ color: 'rgb(var(--c-text))' }}>{t('live.mySessions')}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {mine.map((s) => <SessionCard key={s.id} session={s} t={t} />)}
              </div>
            </section>
          )}

          <section className="mb-6">
            <h2 className="mb-3 text-[1.05rem] font-semibold" style={{ color: 'rgb(var(--c-text))' }}>{t('live.liveNow')}</h2>
            {liveNow.length === 0 ? (
              <div className="rounded-[28px] border p-10 text-center text-sm" style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)', color: 'rgb(var(--c-text-secondary))' }}>
                {t('live.noLiveSessions')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {liveNow.map((s) => <SessionCard key={s.id} session={s} t={t} />)}
              </div>
            )}
          </section>

          {scheduled.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-[1.05rem] font-semibold" style={{ color: 'rgb(var(--c-text))' }}>{t('live.upcoming')}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {scheduled.map((s) => <SessionCard key={s.id} session={s} t={t} />)}
              </div>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
