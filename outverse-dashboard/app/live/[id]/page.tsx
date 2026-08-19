'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeftIcon, EyeIcon, NoSymbolIcon, PaperAirplaneIcon, TrashIcon, VideoCameraSlashIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import { useLocale } from '@/components/LocaleProvider';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import {
  fetchSession,
  startSession,
  endSession,
  fetchLiveState,
  joinSession,
  leaveSession,
  fetchChat,
  sendMessage,
  sendReaction,
  deleteMessage,
  banChatUser,
  setSlowmode,
  sendGift,
  type LiveSession,
  type LiveChatMessage,
  type ReactionType,
} from '@/lib/liveApi';
import { liveHostAssist, liveHostRecap } from '@/lib/aiCoachApi';
import { publishWhip, stopWhip, type WhipSession } from '@/lib/whip';

const REACTIONS: { type: ReactionType; emoji: string }[] = [
  { type: 'heart', emoji: '❤️' },
  { type: 'fire', emoji: '🔥' },
  { type: 'spark', emoji: '✨' },
  { type: 'clap', emoji: '👏' },
  { type: 'thumbs_up', emoji: '👍' },
];

// Kept well under the platform's shared per-user request budget (200/min
// across all endpoints) even with both polling loops running plus normal
// site activity (notifications, etc.) in the background.
const POLL_MS = 8000;

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function LiveSessionPage() {
  const { t } = useLocale();
  const user = useAuthUser();
  const params = useParams();
  const sessionId = Number(params?.id);

  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [reactionBursts, setReactionBursts] = useState<{ id: number; emoji: string }[]>([]);
  const [cameraError, setCameraError] = useState(false);
  const [publishState, setPublishState] = useState<'idle' | 'connecting' | 'live' | 'unavailable' | 'failed'>('idle');
  const [assistBusy, setAssistBusy] = useState(false);
  const [assistQuestions, setAssistQuestions] = useState<string[]>([]);
  const [recapBusy, setRecapBusy] = useState(false);
  const [recap, setRecap] = useState('');
  const [giftAmount, setGiftAmount] = useState('50');
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [slowmodeDraft, setSlowmodeDraft] = useState('0');
  const [slowmodeBusy, setSlowmodeBusy] = useState(false);
  const [slowmodeMessage, setSlowmodeMessage] = useState('');
  const [banBusyId, setBanBusyId] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const whipSessionRef = useRef<WhipSession | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isOwner = !!(user && session && session.user === user.username);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    const result = await fetchSession(sessionId);
    if (result.kind === 'not_found') {
      setNotFound(true);
      setLoading(false);
      return;
    }
    if (result.kind === 'error') {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setLoadError(false);
    setSession(result.session);
    setSlowmodeDraft(String(result.session.slowmode_seconds ?? 0));
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  // Prefer WebSocket for chat + viewers; keep slow poll as fallback.
  useEffect(() => {
    if (!session || !session.chat_enabled) return;
    let cancelled = false;
    let ws: WebSocket | null = null;
    let wsOk = false;

    async function connect() {
      try {
        const { resolveWsUrl } = await import('@/lib/ws');
        const url = await resolveWsUrl('live', { session_id: sessionId });
        if (cancelled) return;
        ws = new WebSocket(url);
        ws.onopen = () => { wsOk = true; };
        ws.onclose = () => { wsOk = false; };
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(String(ev.data));
            if (data?.type === 'live.chat' && data.message) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === data.message.id)) return prev;
                return [...prev, data.message as LiveChatMessage];
              });
            }
            if (data?.type === 'live.viewers' && typeof data.current_viewers === 'number') {
              setSession((prev) => (prev ? { ...prev, current_viewers: data.current_viewers } : prev));
            }
            if (data?.type === 'live.ended') {
              setSession((prev) => (prev ? { ...prev, status: 'ended', is_live: false } : prev));
            }
          } catch {
            /* ignore */
          }
        };
      } catch {
        /* fall back to poll */
      }
    }

    async function poll() {
      const msgs = await fetchChat(sessionId);
      if (!cancelled && msgs !== null && !wsOk) setMessages(msgs);
      if (session?.status === 'live' && !wsOk) {
        const state = await fetchLiveState(sessionId);
        if (!cancelled && state) {
          setSession((prev) => (prev ? { ...prev, ...state } : prev));
        }
      }
    }

    void fetchChat(sessionId).then((msgs) => {
      if (!cancelled && msgs !== null) setMessages(msgs);
    });
    void connect();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      ws?.close();
    };
  }, [session?.status, session?.chat_enabled, sessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Join/leave lifecycle for viewers.
  useEffect(() => {
    if (!user || isOwner || !session || session.status !== 'live') return;
    void joinSession(sessionId);
    return () => {
      void leaveSession(sessionId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, sessionId, isOwner, !!user]);

  // Camera preview + real WHIP publish for the host, while scheduled or live.
  useEffect(() => {
    if (!isOwner || !session || session.status === 'ended' || session.status === 'cancelled') {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      void stopWhip(whipSessionRef.current);
      whipSessionRef.current = null;
      setPublishState('idle');
      return;
    }
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(true);
      return;
    }
    // Some environments never resolve/reject the permission prompt (e.g. no
    // camera device, or a sandboxed browser that silently blocks capture) —
    // fall back to the "unavailable" state instead of waiting forever.
    const timeout = setTimeout(() => { if (!cancelled) setCameraError(true); }, 6000);
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(async (stream) => {
        clearTimeout(timeout);
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        // No real media server configured for this deployment — camera stays
        // a local self-preview only, exactly like before this feature existed.
        if (!session.webrtc_publish_url) {
          setPublishState('unavailable');
          return;
        }
        setPublishState('connecting');
        try {
          const whip = await publishWhip(stream, session.webrtc_publish_url);
          if (cancelled) {
            void stopWhip(whip);
            return;
          }
          whipSessionRef.current = whip;
          setPublishState('live');
        } catch {
          if (!cancelled) setPublishState('failed');
        }
      })
      .catch(() => {
        clearTimeout(timeout);
        if (!cancelled) setCameraError(true);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      void stopWhip(whipSessionRef.current);
      whipSessionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, session?.status, session?.webrtc_publish_url]);

  // HLS playback for viewers once the session is actually live with a real playback URL.
  useEffect(() => {
    if (isOwner || !session || session.status !== 'live' || !session.playback_url) return;
    const video = playerVideoRef.current;
    if (!video) return;
    const src = session.playback_url;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }
    let hls: import('hls.js').default | undefined;
    let cancelled = false;
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) return;
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
    });
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [isOwner, session?.status, session?.playback_url]);

  async function handleStart() {
    const res = await startSession(sessionId);
    if (res.ok) void loadSession();
  }

  async function handleEnd() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    void stopWhip(whipSessionRef.current);
    whipSessionRef.current = null;
    setPublishState('idle');
    const res = await endSession(sessionId);
    if (res.ok) void loadSession();
  }

  async function handleSend() {
    const text = chatText.trim();
    if (!text) return;
    setChatText('');
    const msg = await sendMessage(sessionId, text);
    if (msg) setMessages((prev) => [...prev, msg]);
  }

  async function handleReact(type: ReactionType, emoji: string) {
    const burstId = Date.now() + Math.random();
    setReactionBursts((prev) => [...prev, { id: burstId, emoji }]);
    setTimeout(() => setReactionBursts((prev) => prev.filter((b) => b.id !== burstId)), 1500);
    void sendReaction(sessionId, type);
  }

  async function handleDeleteMessage(id: number) {
    const ok = await deleteMessage(sessionId, id);
    if (ok) setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleBanUser(userId: number) {
    setBanBusyId(userId);
    const ok = await banChatUser(sessionId, userId);
    setBanBusyId(null);
    if (ok) {
      setMessages((prev) => prev.filter((m) => m.user_id !== userId));
    }
  }

  async function handleSetSlowmode() {
    const seconds = Math.max(0, Math.min(600, Number.parseInt(slowmodeDraft, 10) || 0));
    setSlowmodeBusy(true);
    setSlowmodeMessage('');
    const ok = await setSlowmode(sessionId, seconds);
    setSlowmodeBusy(false);
    if (ok) {
      setSlowmodeMessage(t('live.slowmodeSaved'));
      setSession((prev) => (prev ? { ...prev, slowmode_seconds: seconds } : prev));
    }
  }

  async function handleSendGift() {
    const amount = Number.parseInt(giftAmount, 10);
    if (!amount || amount <= 0) return;
    setGiftBusy(true);
    setGiftMessage('');
    const res = await sendGift(sessionId, amount);
    setGiftBusy(false);
    setGiftMessage(res.ok ? t('live.giftSent') : res.error || t('live.giftFailed'));
  }

  async function handleHostAssist() {
    setAssistBusy(true);
    const result = await liveHostAssist(sessionId);
    setAssistBusy(false);
    if (!result.error) setAssistQuestions(result.questions);
  }

  async function handleRecap() {
    setRecapBusy(true);
    const result = await liveHostRecap(sessionId);
    setRecapBusy(false);
    if (!result.error) setRecap(result.summary);
  }

  if (!user) {
    return (
      <AppShell contentClassName="flex-1 min-w-0 w-full max-w-2xl mx-auto px-4 pb-12">
        <div className="mt-10 rounded-[28px] border p-10 text-center text-sm" style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)', color: 'rgb(var(--c-text-secondary))' }}>
          {t('live.signInPrompt')}
        </div>
      </AppShell>
    );
  }

  if (notFound) {
    return (
      <AppShell contentClassName="flex-1 min-w-0 w-full max-w-2xl mx-auto px-4 pb-12">
        <div className="mt-10 rounded-[28px] border p-10 text-center text-sm" style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)', color: 'rgb(var(--c-text-secondary))' }}>
          {t('live.notFound')}
        </div>
        <Link href="/live" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--c-focus)' }}>
          <ArrowLeftIcon className="h-4 w-4" />
          {t('live.back')}
        </Link>
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell contentClassName="flex-1 min-w-0 w-full max-w-2xl mx-auto px-4 pb-12">
        <div className="mt-10 rounded-[28px] border p-10 text-center text-sm space-y-3" style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)', color: 'rgb(var(--c-text-secondary))' }}>
          <p>{t('live.loadError')}</p>
          <button
            type="button"
            onClick={() => { setLoading(true); void loadSession(); }}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--c-focus)' }}
          >
            {t('common.tryAgain')}
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-2xl mx-auto px-4 pb-12">
      <section className="mb-4 mt-4">
        <Link href="/live" className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--c-focus)' }}>
          <ArrowLeftIcon className="h-4 w-4" />
          {t('live.back')}
        </Link>
      </section>

      {loading || !session ? (
        <p className="text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>{t('common.loading')}</p>
      ) : (
        <>
          <section className="mb-4 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'rgb(var(--c-text))' }}>{session.title}</h1>
              <p className="mt-1 text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>
                {isOwner ? t('live.you') : `${t('live.host')}: ${session.user}`}
                {session.description ? ` — ${session.description}` : ''}
              </p>
            </div>
            {session.status === 'live' && (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 rounded-full bg-red-500/90 px-3 py-1.5 text-xs font-bold text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  {t('live.statusLive')}
                </span>
                <span className="flex items-center gap-1.5 text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>
                  <EyeIcon className="h-4 w-4" />
                  {session.current_viewers.toLocaleString()}
                </span>
                <span className="text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>
                  {formatDuration(session.duration_seconds)}
                </span>
              </div>
            )}
          </section>

          {/* Video area */}
          <section className="relative mb-4 aspect-video overflow-hidden rounded-2xl" style={{ background: '#0a0a12' }}>
            {isOwner && session.status !== 'ended' && session.status !== 'cancelled' ? (
              cameraError ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center px-6">
                  <VideoCameraSlashIcon className="h-8 w-8" style={{ color: 'rgb(var(--c-text-secondary))' }} />
                  <p className="text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>{t('live.cameraError')}</p>
                </div>
              ) : (
                <>
                  <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
                    {t('live.cameraPreview')}
                  </span>
                  {publishState === 'connecting' && (
                    <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
                      {t('live.publishConnecting')}
                    </span>
                  )}
                  {publishState === 'live' && (
                    <span className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-red-500/90 px-2.5 py-1 text-xs font-bold text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      {t('live.publishLive')}
                    </span>
                  )}
                  {publishState === 'failed' && (
                    <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
                      {t('live.publishFailed')}
                    </span>
                  )}
                  {publishState === 'unavailable' && (
                    <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
                      {t('live.publishUnavailable')}
                    </span>
                  )}
                </>
              )
            ) : session.status === 'live' && session.playback_url ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video ref={playerVideoRef} autoPlay playsInline controls className="h-full w-full object-cover" />
            ) : session.status === 'live' ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center px-6">
                <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                <p className="text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>{t('live.videoUnavailable')}</p>
              </div>
            ) : session.status === 'scheduled' ? (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <p className="text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>{t('live.scheduledNotLive')}</p>
              </div>
            ) : session.recording_url ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={session.recording_url} controls playsInline className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-lg font-semibold text-white">{t('live.endedTitle')}</p>
                <div className="flex gap-6 text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>
                  <span>{t('live.duration')}: {formatDuration(session.duration_seconds)}</span>
                  <span>{t('live.peakViewers')}: {session.peak_viewers}</span>
                  <span>{t('live.totalViews')}: {session.total_views}</span>
                </div>
              </div>
            )}

            {/* Reaction burst overlay */}
            <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col items-center">
              {reactionBursts.map((b) => (
                <span key={b.id} className="animate-bounce text-2xl" style={{ animationDuration: '1.5s' }}>{b.emoji}</span>
              ))}
            </div>
          </section>

          {session.status === 'ended' && session.recording_url && (
            <section className="mb-4 flex gap-6 text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>
              <span>{t('live.duration')}: {formatDuration(session.duration_seconds)}</span>
              <span>{t('live.peakViewers')}: {session.peak_viewers}</span>
              <span>{t('live.totalViews')}: {session.total_views}</span>
            </section>
          )}

          {/* Host controls */}
          {isOwner && (
            <section className="mb-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                {session.status === 'scheduled' && (
                  <button
                    type="button"
                    onClick={() => void handleStart()}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                    style={{ background: 'var(--c-focus)' }}
                  >
                    {t('live.startStream')}
                  </button>
                )}
                {session.status === 'live' && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleEnd()}
                      className="rounded-xl px-4 py-2.5 text-sm font-semibold"
                      style={{ background: 'rgb(var(--c-surface))', color: 'var(--c-icon)', border: '1px solid var(--c-border)' }}
                    >
                      {t('live.endStream')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleHostAssist()}
                      disabled={assistBusy}
                      className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      style={{ background: 'var(--c-focus)' }}
                    >
                      {assistBusy ? t('live.gettingIdeas') : t('live.hostAssist')}
                    </button>
                    <label className="flex items-center gap-2 text-xs" style={{ color: 'rgb(var(--c-text-secondary))' }}>
                      {t('live.slowmodeLabel')}
                      <input
                        type="number"
                        min={0}
                        max={600}
                        value={slowmodeDraft}
                        onChange={(e) => setSlowmodeDraft(e.target.value)}
                        className="w-16 rounded-lg px-2 py-1 text-sm"
                        style={{ background: 'rgb(var(--c-surface))', color: 'rgb(var(--c-text))', border: '1px solid var(--c-border)' }}
                      />
                      <button
                        type="button"
                        onClick={() => void handleSetSlowmode()}
                        disabled={slowmodeBusy}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                        style={{ background: 'var(--c-focus)' }}
                      >
                        {t('common.save')}
                      </button>
                      {slowmodeMessage && <span>{slowmodeMessage}</span>}
                    </label>
                  </>
                )}
                {(session.status === 'ended' || session.status === 'cancelled') && (
                  <button
                    type="button"
                    onClick={() => void handleRecap()}
                    disabled={recapBusy}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: 'var(--c-focus)' }}
                  >
                    {recapBusy ? t('live.generatingRecap') : t('live.sessionRecap')}
                  </button>
                )}
              </div>

              {assistQuestions.length > 0 && (
                <div className="rounded-2xl border p-4 text-sm space-y-2" style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)' }}>
                  <p className="font-semibold text-xs uppercase tracking-wide" style={{ color: 'rgb(var(--c-text-secondary))' }}>{t('live.assistQuestionsTitle')}</p>
                  <ul className="space-y-1.5" style={{ color: 'rgb(var(--c-text))' }}>
                    {assistQuestions.map((q, i) => (
                      <li key={i} className="flex gap-2"><span style={{ color: 'var(--c-focus)' }}>›</span>{q}</li>
                    ))}
                  </ul>
                </div>
              )}

              {recap && (
                <div className="rounded-2xl border p-4 text-sm" style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)' }}>
                  <p className="font-semibold text-xs uppercase tracking-wide mb-2" style={{ color: 'rgb(var(--c-text-secondary))' }}>{t('live.recapTitle')}</p>
                  <p style={{ color: 'rgb(var(--c-text))' }}>{recap}</p>
                </div>
              )}
            </section>
          )}

          {/* OBS/RTMP details — an alternative to in-browser publishing */}
          {isOwner && session.rtmp_url && session.status !== 'ended' && session.status !== 'cancelled' && (
            <section className="mb-4 rounded-2xl border p-4 text-xs space-y-2" style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)', color: 'rgb(var(--c-text-secondary))' }}>
              <p className="font-semibold" style={{ color: 'rgb(var(--c-text))' }}>{t('live.obsTitle')}</p>
              <p className="font-mono break-all" dir="ltr">{t('live.obsServerLabel')}: {session.rtmp_url}</p>
              <p className="font-mono break-all" dir="ltr">{t('live.obsKeyLabel')}: {session.stream_key}</p>
            </section>
          )}

          {/* Reactions */}
          {session.status === 'live' && (
            <section className="mb-4 flex flex-wrap items-center gap-2">
              {REACTIONS.map((r) => (
                <button
                  key={r.type}
                  type="button"
                  onClick={() => void handleReact(r.type, r.emoji)}
                  className="rounded-full px-3 py-2 text-lg"
                  style={{ background: 'rgb(var(--c-surface))', border: '1px solid var(--c-border)' }}
                >
                  {r.emoji}
                </button>
              ))}
              {!isOwner && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    value={giftAmount}
                    onChange={(e) => setGiftAmount(e.target.value)}
                    className="w-16 rounded-full px-3 py-2 text-sm"
                    style={{ background: 'rgb(var(--c-surface))', color: 'rgb(var(--c-text))', border: '1px solid var(--c-border)' }}
                    aria-label={t('live.giftAmountPlaceholder')}
                    placeholder={t('live.giftAmountPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendGift()}
                    disabled={giftBusy}
                    className="rounded-full px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: 'var(--c-focus)' }}
                  >
                    🎁 {giftBusy ? t('live.giftSending') : t('live.giftSend')}
                  </button>
                  {giftMessage && (
                    <span className="text-xs" style={{ color: 'rgb(var(--c-text-secondary))' }}>{giftMessage}</span>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Chat */}
          <section className="rounded-[28px] border" style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)' }}>
            <h2 className="px-5 pt-5 pb-2 text-[1.05rem] font-semibold" style={{ color: 'rgb(var(--c-text))' }}>{t('live.chat')}</h2>
            {!session.chat_enabled ? (
              <p className="px-5 pb-5 text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>{t('live.chatDisabled')}</p>
            ) : (
              <>
                <div className="max-h-80 space-y-2 overflow-y-auto px-5 pb-3">
                  {messages.map((m) => (
                    <div key={m.id} className="flex items-start justify-between gap-2 text-sm">
                      <p style={{ color: 'rgb(var(--c-text))' }}>
                        <span className="font-semibold">{m.user}</span>{' '}
                        <span style={{ color: 'rgb(var(--c-text-secondary))' }}>{m.text}</span>
                      </p>
                      {isOwner && (
                        <span className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleDeleteMessage(m.id)}
                            aria-label={t('live.deleteMessage')}
                            style={{ color: 'rgb(var(--c-text-secondary))' }}
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                          {m.user_id !== user?.id && (
                            <button
                              type="button"
                              onClick={() => void handleBanUser(m.user_id)}
                              disabled={banBusyId === m.user_id}
                              aria-label={t('live.banUser')}
                              title={t('live.banUser')}
                              style={{ color: 'rgb(var(--c-text-secondary))' }}
                            >
                              <NoSymbolIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                {session.status === 'live' && (
                  <div className="flex items-center gap-2 border-t px-5 py-3" style={{ borderColor: 'var(--c-border)' }}>
                    <input
                      type="text"
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleSend(); }}
                      placeholder={t('live.chatPlaceholder')}
                      maxLength={500}
                      className="flex-1 rounded-xl px-3 py-2 text-sm"
                      style={{ background: 'rgb(var(--c-surface))', color: 'rgb(var(--c-text))', border: '1px solid var(--c-border)' }}
                    />
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      aria-label={t('live.send')}
                      className="rounded-xl px-3 py-2 text-white"
                      style={{ background: 'var(--c-focus)' }}
                    >
                      <PaperAirplaneIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
