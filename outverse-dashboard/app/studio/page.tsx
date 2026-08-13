'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch, apiFetchJson, apiUrl, mediaUrl } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { useStudioSocket, type StudioEvent, type StudioShapeKind, type StudioUser } from '@/hooks/useStudioSocket';
import { PlusIcon, TrashIcon, ArrowUturnLeftIcon, PhotoIcon, UserPlusIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';

const BASE = apiUrl('studio/sessions');
const CANVAS_W = 800;
const CANVAS_H = 480;
const PALETTE = ['#5B21B6', '#DC2626', '#059669', '#2563EB', '#D97706', '#111827'];

const PALETTES = {
  light: {
    cream: '#F3F0FC', card: '#E9E1FA', card2: '#F5F1FE', white: '#FFFFFF',
    brown: '#7C3AED', brownDk: '#5B21B6', text: '#211B3D', text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
  },
  dark: {
    cream: '#14102A', card: '#1E1740', card2: '#251B4D', white: '#2A2154',
    brown: '#C4B5FD', brownDk: '#A78BFA', text: '#F5F3FF', text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)',
  },
} as const;

type Stroke = { id: number; user: StudioUser; points: { x: number; y: number }[]; color: string; width: number };
type MediaItem = {
  id: number; user: StudioUser; image: string | null;
  x: number; y: number; width: number; height: number; rotation: number; z_index: number; filter: string;
};
type ShapeItem = {
  id: number; user: StudioUser; kind: StudioShapeKind;
  x: number; y: number; width: number; height: number; rotation: number; z_index: number;
  color: string; stroke_width: number;
};
type TextItem = {
  id: number; user: StudioUser; text: string;
  x: number; y: number; width: number; height: number; rotation: number; z_index: number;
  color: string; font_size: number;
};
type ChatMsg = { user: StudioUser; text: string };
type FollowingUser = { id: number; username: string; avatar: string | null };
type Session = { id: number; title: string; host: { id?: number; username: string }; mode: 'solo' | 'live'; is_live: boolean };
type SessionDetail = Session & {
  strokes: Stroke[];
  media: MediaItem[];
  shapes: ShapeItem[];
  texts: TextItem[];
  participants: { user: StudioUser }[];
};

type SelectionKind = 'media' | 'shape' | 'text';
type Selection = { kind: SelectionKind; id: number };

type DragState = {
  target: SelectionKind;
  id: number;
  mode: 'move' | 'resize' | 'rotate';
  startX: number;
  startY: number;
  item: { x: number; y: number; width: number; height: number; rotation: number };
  centerX: number;
  centerY: number;
  startAngle: number;
};

function getCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function parseFilter(filter: string) {
  const b = /brightness\(([\d.]+)\)/.exec(filter)?.[1];
  const c = /contrast\(([\d.]+)\)/.exec(filter)?.[1];
  const s = /saturate\(([\d.]+)\)/.exec(filter)?.[1];
  return { brightness: b ? Number(b) : 1, contrast: c ? Number(c) : 1, saturate: s ? Number(s) : 1 };
}

function StudioPageInner() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const user = useAuthUser();
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState<SessionDetail | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [shapes, setShapes] = useState<ShapeItem[]>([]);
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [participants, setParticipants] = useState<StudioUser[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);

  const [drawing, setDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const [color, setColor] = useState(PALETTE[0]);
  const [brushWidth, setBrushWidth] = useState(3);
  const [eraser, setEraser] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<Selection | null>(null);
  const [placingShape, setPlacingShape] = useState<StudioShapeKind | null>(null);
  const [placingText, setPlacingText] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [following, setFollowing] = useState<FollowingUser[] | null>(null);
  const [inviting, setInviting] = useState<number | null>(null);

  const dragRef = useRef<DragState | null>(null);

  const isHost = !!(active && user && active.host.username === user.username);
  const isLive = active?.mode === 'live';

  const loadSessions = useCallback(async () => {
    const res = await fetch(`${BASE}/`);
    if (res.ok) {
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : data.results || []);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const drawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const all = currentStroke.length > 1 ? [...strokes, { id: -1, user: null as never, points: currentStroke, color: eraser ? C.white : color, width: brushWidth }] : strokes;
    for (const stroke of all) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const point of stroke.points.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  }, [strokes, currentStroke, color, brushWidth, eraser, C.white]);

  useEffect(() => {
    drawAll();
  }, [drawAll]);

  function onStudioEvent(event: StudioEvent) {
    switch (event.type) {
      case 'participant.joined':
        setParticipants((prev) => (prev.some((p) => p.id === event.user.id) ? prev : [...prev, event.user]));
        break;
      case 'participant.left':
        setParticipants((prev) => prev.filter((p) => p.id !== event.user_id));
        break;
      case 'stroke.added':
        setStrokes((prev) => [...prev, { id: event.id, user: event.user, points: event.points, color: event.color, width: event.width }]);
        break;
      case 'stroke.removed':
        setStrokes((prev) => prev.filter((s) => s.id !== event.id));
        break;
      case 'media.added':
        setMediaItems((prev) => (prev.some((m) => m.id === event.id) ? prev : [...prev, { ...event }]));
        break;
      case 'media.transformed':
        setMediaItems((prev) => prev.map((m) => (m.id === event.id ? { ...m, x: event.x, y: event.y, width: event.width, height: event.height, rotation: event.rotation, filter: event.filter } : m)));
        break;
      case 'shape.added':
        setShapes((prev) => (prev.some((s) => s.id === event.id) ? prev : [...prev, { ...event }]));
        break;
      case 'shape.transformed':
        setShapes((prev) => prev.map((s) => (s.id === event.id ? { ...s, x: event.x, y: event.y, width: event.width, height: event.height, rotation: event.rotation } : s)));
        break;
      case 'shape.deleted':
        setShapes((prev) => prev.filter((s) => s.id !== event.id));
        setSelected((prev) => (prev?.kind === 'shape' && prev.id === event.id ? null : prev));
        break;
      case 'text.added':
        setTexts((prev) => (prev.some((tx) => tx.id === event.id) ? prev : [...prev, { ...event }]));
        break;
      case 'text.transformed':
        setTexts((prev) => prev.map((tx) => (tx.id === event.id ? { ...tx, x: event.x, y: event.y, width: event.width, height: event.height, rotation: event.rotation, text: event.text, color: event.color, font_size: event.font_size } : tx)));
        break;
      case 'text.deleted':
        setTexts((prev) => prev.filter((tx) => tx.id !== event.id));
        setSelected((prev) => (prev?.kind === 'text' && prev.id === event.id ? null : prev));
        break;
      case 'media.deleted':
        setMediaItems((prev) => prev.filter((m) => m.id !== event.id));
        setSelected((prev) => (prev?.kind === 'media' && prev.id === event.id ? null : prev));
        break;
      case 'layer.reordered':
        if (event.kind === 'media') setMediaItems((prev) => prev.map((m) => (m.id === event.id ? { ...m, z_index: event.z_index } : m)));
        else if (event.kind === 'shape') setShapes((prev) => prev.map((s) => (s.id === event.id ? { ...s, z_index: event.z_index } : s)));
        else setTexts((prev) => prev.map((tx) => (tx.id === event.id ? { ...tx, z_index: event.z_index } : tx)));
        break;
      case 'chat.message':
        setChatMessages((prev) => [...prev.slice(-49), { user: event.user, text: event.text }]);
        break;
      case 'session.cleared':
        setStrokes([]);
        setMediaItems([]);
        setShapes([]);
        setTexts([]);
        setSelected(null);
        break;
      default:
        break;
    }
  }

  const { send } = useStudioSocket({ sessionId: isLive ? active!.id : null, onEvent: onStudioEvent });

  async function createSession() {
    const res = await apiFetchJson('studio/sessions/', {
      method: 'POST',
      json: { title: `Session ${new Date().toLocaleTimeString()}` },
    });
    if (res.ok) {
      await loadSessions();
      await openSession((await res.json()).id);
    }
  }

  async function openSession(id: number) {
    const res = await apiFetch(`studio/sessions/${id}/`);
    if (!res.ok) return;
    const data = (await res.json()) as SessionDetail;
    setActive(data);
    setStrokes(data.strokes || []);
    setMediaItems((data.media || []).map((m) => ({ ...m, image: m.image ? mediaUrl(m.image) : null })));
    setShapes(data.shapes || []);
    setTexts(data.texts || []);
    setParticipants((data.participants || []).map((p) => p.user));
    setChatMessages([]);
    setSelected(null);
    setPlacingShape(null);
    setPlacingText(false);
    setInviteOpen(false);
  }

  useEffect(() => {
    const sid = searchParams.get('session');
    if (sid) void openSession(Number(sid));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function closeSession() {
    setActive(null);
    setStrokes([]);
    setMediaItems([]);
    setShapes([]);
    setTexts([]);
    setParticipants([]);
    setChatMessages([]);
    setSelected(null);
    setPlacingShape(null);
    setPlacingText(false);
    setInviteOpen(false);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!user || !active) return;
    setSelected(null);
    if (placingShape) {
      const point = getCanvasPoint(canvasRef.current!, event.clientX, event.clientY);
      const w = placingShape === 'line' ? 160 : 120;
      const h = placingShape === 'line' ? 4 : 120;
      send('shape.add', { kind: placingShape, x: point.x - w / 2, y: point.y - h / 2, width: w, height: h, color, stroke_width: brushWidth });
      setPlacingShape(null);
      return;
    }
    if (placingText) {
      const point = getCanvasPoint(canvasRef.current!, event.clientX, event.clientY);
      send('text.add', { x: point.x - 100, y: point.y - 30, color, font_size: 24 });
      setPlacingText(false);
      return;
    }
    setDrawing(true);
    const point = getCanvasPoint(canvasRef.current!, event.clientX, event.clientY);
    setCurrentStroke([point]);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const point = getCanvasPoint(canvasRef.current!, event.clientX, event.clientY);
    setCurrentStroke((prev) => [...prev, point]);
  }

  async function handlePointerUp() {
    if (!drawing || !active) return;
    setDrawing(false);
    const points = currentStroke;
    setCurrentStroke([]);
    if (points.length < 2) return;
    const strokeColor = eraser ? C.white : color;
    if (isLive) {
      send('stroke.add', { points, color: strokeColor, width: brushWidth });
    } else {
      const res = await apiFetchJson(`studio/sessions/${active.id}/strokes/`, {
        method: 'POST',
        json: { points, color: strokeColor, width: brushWidth },
      });
      if (res.ok) {
        const stroke = (await res.json()) as Stroke;
        setStrokes((prev) => [...prev, stroke]);
      }
    }
  }

  function undoLastStroke() {
    send('stroke.undo');
  }

  function clearSession() {
    if (!isHost) return;
    send('session.clear');
  }

  async function handlePhotoSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !active) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(t('studio.uploadFailed'));
      return;
    }
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('x', '40');
      form.append('y', '40');
      form.append('width', '220');
      form.append('height', '220');
      const res = await apiFetch(`studio/sessions/${active.id}/media/`, { method: 'POST', body: form });
      if (!res.ok) throw new Error('upload failed');
      const media = await res.json();
      const resolved = { ...media, image: media.image ? mediaUrl(media.image) : null };
      setMediaItems((prev) => [...prev, resolved]);
      if (isLive) send('media.added', { id: media.id });
    } catch {
      setError(t('studio.uploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  function startDrag(target: SelectionKind, item: { id: number; x: number; y: number; width: number; height: number; rotation: number }, mode: 'move' | 'resize' | 'rotate', event: React.PointerEvent) {
    event.stopPropagation();
    setSelected({ kind: target, id: item.id });
    let centerX = 0;
    let centerY = 0;
    let startAngle = 0;
    const canvas = canvasRef.current;
    if (mode === 'rotate' && canvas) {
      const rect = canvas.getBoundingClientRect();
      centerX = rect.left + ((item.x + item.width / 2) / CANVAS_W) * rect.width;
      centerY = rect.top + ((item.y + item.height / 2) / CANVAS_H) * rect.height;
      startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
    }
    dragRef.current = { target, id: item.id, mode, startX: event.clientX, startY: event.clientY, item, centerX, centerY, startAngle };
    try {
      (event.target as Element).setPointerCapture(event.pointerId);
    } catch {
      /* pointer already released — drag still tracked via dragRef */
    }
  }

  function onContainerPointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    function nextGeometry<T extends { x: number; y: number; width: number; height: number; rotation: number }>(it: T): T {
      if (drag!.mode === 'move') {
        const dx = (event.clientX - drag!.startX) * scaleX;
        const dy = (event.clientY - drag!.startY) * scaleY;
        return { ...it, x: drag!.item.x + dx, y: drag!.item.y + dy };
      }
      if (drag!.mode === 'resize') {
        const dx = (event.clientX - drag!.startX) * scaleX;
        const dy = (event.clientY - drag!.startY) * scaleY;
        return { ...it, width: Math.max(30, drag!.item.width + dx), height: Math.max(30, drag!.item.height + dy) };
      }
      const angle = Math.atan2(event.clientY - drag!.centerY, event.clientX - drag!.centerX) * (180 / Math.PI);
      return { ...it, rotation: drag!.item.rotation + (angle - drag!.startAngle) };
    }

    if (drag.target === 'media') {
      setMediaItems((prev) => prev.map((m) => (m.id === drag.id ? nextGeometry(m) : m)));
    } else if (drag.target === 'shape') {
      setShapes((prev) => prev.map((s) => (s.id === drag.id ? nextGeometry(s) : s)));
    } else {
      setTexts((prev) => prev.map((tx) => (tx.id === drag.id ? nextGeometry(tx) : tx)));
    }
  }

  async function onContainerPointerUp() {
    const drag = dragRef.current;
    if (!drag || !active) return;
    dragRef.current = null;
    if (drag.target === 'media') {
      const item = mediaItems.find((m) => m.id === drag.id);
      if (!item) return;
      if (isLive) {
        send('media.transform', { id: item.id, x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation, filter: item.filter });
      } else {
        await apiFetchJson(`studio/sessions/${active.id}/media/${item.id}/`, {
          method: 'PATCH',
          json: { x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation, filter: item.filter },
        });
      }
    } else if (drag.target === 'shape') {
      const item = shapes.find((s) => s.id === drag.id);
      if (item) send('shape.transform', { id: item.id, x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation });
    } else {
      const item = texts.find((tx) => tx.id === drag.id);
      if (item) send('text.transform', { id: item.id, x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation, text: item.text, color: item.color, font_size: item.font_size });
    }
  }

  function updateFilter(id: number, brightness: number, contrast: number, saturate: number) {
    const filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`;
    setMediaItems((prev) => prev.map((m) => (m.id === id ? { ...m, filter } : m)));
    const item = mediaItems.find((m) => m.id === id);
    if (item) send('media.transform', { id, x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation, filter });
  }

  function updateText(id: number, patch: Partial<Pick<TextItem, 'text' | 'font_size'>>) {
    setTexts((prev) => prev.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx)));
    const item = texts.find((tx) => tx.id === id);
    if (!item) return;
    const next = { ...item, ...patch };
    send('text.transform', { id, x: next.x, y: next.y, width: next.width, height: next.height, rotation: next.rotation, text: next.text, color: next.color, font_size: next.font_size });
  }

  function deleteSelected() {
    if (!selected || !active) return;
    const { kind, id } = selected;
    setSelected(null);
    if (kind === 'media') {
      setMediaItems((prev) => prev.filter((m) => m.id !== id));
      void apiFetch(`studio/sessions/${active.id}/media/${id}/`, { method: 'DELETE' }).then(() => {
        if (isLive) send('media.deleted', { id });
      });
    } else if (kind === 'shape') {
      send('shape.delete', { id });
    } else {
      send('text.delete', { id });
    }
  }

  function reorderSelected(direction: 'front' | 'back') {
    if (!selected || !active) return;
    const { kind, id } = selected;
    if (isLive) {
      send('layer.reorder', { kind, id, direction });
      return;
    }
    if (kind !== 'media') return;
    void apiFetchJson(`studio/sessions/${active.id}/media/${id}/reorder/`, { method: 'POST', json: { direction } }).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      setMediaItems((prev) => prev.map((m) => (m.id === id ? { ...m, z_index: data.z_index } : m)));
    });
  }

  async function openInvite() {
    setInviteOpen((v) => !v);
    if (!following && user) {
      const res = await apiFetch(`users/${user.id}/following/`);
      setFollowing(res.ok ? await res.json() : []);
    }
  }

  async function sendInvite(toUserId: number) {
    if (!active) return;
    setInviting(toUserId);
    try {
      const res = await apiFetchJson(`studio/sessions/${active.id}/invite/`, {
        method: 'POST',
        json: { to_user_id: toUserId },
      });
      if (res.ok) {
        const data = (await res.json()) as SessionDetail;
        setActive(data);
        setInviteOpen(false);
      } else {
        setError(t('studio.inviteFailed'));
      }
    } finally {
      setInviting(null);
    }
  }

  function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    send('chat.send', { text });
    setChatInput('');
  }

  return (
    <WorldShell colors={C}>
      <div className="max-w-4xl mx-auto pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: C.brown }}>🎨 {t('studio.title')}</h1>
            <p className="text-sm" style={{ color: C.text2 }}>{t('studio.subtitle')}</p>
          </div>
          {user && !active && (
            <button type="button" onClick={() => void createSession()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white shrink-0" style={{ background: C.brownDk }}>
              <PlusIcon className="h-4 w-4" />
              {t('studio.newSession')}
            </button>
          )}
        </div>

        {!active ? (
          <div className="grid sm:grid-cols-3 gap-3">
            {sessions.length === 0 ? (
              <div className="col-span-full rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>{t('studio.empty')}</div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => void openSession(session.id)}
                  className="rounded-2xl p-4 text-left"
                  style={{ background: C.white, border: `1px solid ${C.line}` }}
                >
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold" style={{ color: C.text }}>{session.title}</p>
                    {session.mode === 'live' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white shrink-0" style={{ background: '#dc2626' }}>
                        {t('studio.live')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: C.text2 }}>@{session.host.username}</p>
                </button>
              ))
            )}
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <p className="font-semibold truncate" style={{ color: C.text }}>{active.title}</p>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shrink-0"
                  style={{ background: isLive ? '#dc2626' : C.brownDk }}
                >
                  {isLive && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                  {isLive ? t('studio.live') : t('studio.solo')}
                </span>
                {isLive && (
                  <div className="flex -space-x-2 shrink-0">
                    {participants.slice(0, 5).map((p) => (
                      <span
                        key={p.id}
                        title={p.username}
                        className="w-6 h-6 rounded-full ring-2 flex items-center justify-center text-[9px] font-bold text-white overflow-hidden"
                        style={{ background: C.brownDk, borderColor: C.white }}
                      >
                        {p.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaUrl(p.avatar)} alt={p.username} className="w-full h-full object-cover" />
                        ) : (
                          p.username.slice(0, 2).toUpperCase()
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {isLive && (
                  <button
                    type="button"
                    onClick={() => setChatOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ background: chatOpen ? C.brownDk : C.card2, color: chatOpen ? '#fff' : C.brownDk }}
                  >
                    <ChatBubbleLeftIcon className="h-3.5 w-3.5" />
                    {t('studio.chat')}{chatMessages.length > 0 ? ` (${chatMessages.length})` : ''}
                  </button>
                )}
                {isHost && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => void openInvite()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                      style={{ background: C.card2, color: C.brownDk }}
                    >
                      <UserPlusIcon className="h-3.5 w-3.5" />
                      {t('studio.invite')}
                    </button>
                    {inviteOpen && (
                      <div className="absolute end-0 z-20 mt-2 w-56 rounded-xl p-2 shadow-lg" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                        <p className="text-xs font-semibold px-1 pb-1" style={{ color: C.text }}>{t('studio.inviteTitle')}</p>
                        {following === null ? (
                          <p className="text-xs px-1 py-2" style={{ color: C.text2 }}>…</p>
                        ) : following.length === 0 ? (
                          <p className="text-xs px-1 py-2" style={{ color: C.text2 }}>{t('studio.inviteEmpty')}</p>
                        ) : (
                          <div className="max-h-56 overflow-y-auto">
                            {following.map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => void sendInvite(f.id)}
                                disabled={inviting === f.id}
                                className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-lg text-xs disabled:opacity-50"
                                style={{ color: C.text }}
                              >
                                <span className="w-6 h-6 rounded-full overflow-hidden shrink-0" style={{ background: C.card2 }}>
                                  {f.avatar && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={mediaUrl(f.avatar)} alt="" className="w-full h-full object-cover" />
                                  )}
                                </span>
                                {f.username}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={clearSession}
                  disabled={!isHost}
                  title={isHost ? undefined : t('studio.hostOnly')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-40"
                  style={{ background: C.card2, color: C.brownDk }}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  {t('studio.clearView')}
                </button>
                <button type="button" onClick={closeSession} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: C.card2, color: C.brownDk }}>
                  {t('studio.back')}
                </button>
              </div>
            </div>

            {user && (
              <div className="flex flex-wrap items-center gap-3 mb-3 p-2.5 rounded-2xl" style={{ background: C.card2 }}>
                <div className="flex items-center gap-1.5">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setColor(c); setEraser(false); }}
                      className="w-6 h-6 rounded-full shrink-0"
                      style={{ background: c, border: !eraser && color === c ? `2px solid ${C.brown}` : '2px solid transparent', boxShadow: !eraser && color === c ? `0 0 0 2px ${C.white}` : undefined }}
                      aria-label={c}
                    />
                  ))}
                </div>
                <input
                  type="range"
                  min={1}
                  max={16}
                  value={brushWidth}
                  onChange={(e) => setBrushWidth(Number(e.target.value))}
                  className="w-20"
                />
                <button
                  type="button"
                  onClick={() => setEraser((v) => !v)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{ background: eraser ? C.brownDk : C.white, color: eraser ? '#fff' : C.text }}
                >
                  {t('studio.eraser')}
                </button>
                {isLive && (
                  <>
                    <button
                      type="button"
                      onClick={undoLastStroke}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={{ background: C.white, color: C.text }}
                    >
                      <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                      {t('studio.undo')}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => { setPlacingText(false); setPlacingShape((v) => (v === 'rectangle' ? null : 'rectangle')); }}
                        title={t('studio.shapeRectangle')}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: placingShape === 'rectangle' ? C.brownDk : C.white }}
                      >
                        <span className="w-3.5 h-3" style={{ border: `1.5px solid ${placingShape === 'rectangle' ? '#fff' : C.text}` }} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPlacingText(false); setPlacingShape((v) => (v === 'circle' ? null : 'circle')); }}
                        title={t('studio.shapeCircle')}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: placingShape === 'circle' ? C.brownDk : C.white }}
                      >
                        <span className="w-3.5 h-3.5 rounded-full" style={{ border: `1.5px solid ${placingShape === 'circle' ? '#fff' : C.text}` }} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPlacingText(false); setPlacingShape((v) => (v === 'line' ? null : 'line')); }}
                        title={t('studio.shapeLine')}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: placingShape === 'line' ? C.brownDk : C.white }}
                      >
                        <span className="w-3.5 h-0.5" style={{ background: placingShape === 'line' ? '#fff' : C.text }} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPlacingShape(null); setPlacingText((v) => !v); }}
                        title={t('studio.textTool')}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ background: placingText ? C.brownDk : C.white, color: placingText ? '#fff' : C.text }}
                      >
                        T
                      </button>
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="ms-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                  style={{ background: C.brownDk }}
                >
                  <PhotoIcon className="h-3.5 w-3.5" />
                  {t('studio.addPhoto')}
                </button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => void handlePhotoSelect(e)} />
              </div>
            )}

            {selected && (() => {
              const mediaSel = selected.kind === 'media' ? mediaItems.find((m) => m.id === selected.id) : null;
              const textSel = selected.kind === 'text' ? texts.find((tx) => tx.id === selected.id) : null;
              if (selected.kind === 'media' && !mediaSel) return null;
              if (selected.kind === 'text' && !textSel) return null;
              const filterVals = mediaSel ? parseFilter(mediaSel.filter || '') : null;
              return (
                <div className="flex flex-wrap items-center gap-3 mb-3 p-2.5 rounded-2xl text-xs" style={{ background: C.card2, color: C.text }}>
                  {mediaSel && isLive && filterVals && (
                    <>
                      <span className="font-semibold">{t('studio.filters')}</span>
                      <label className="flex items-center gap-1.5">
                        {t('studio.brightness')}
                        <input type="range" min={0.5} max={1.5} step={0.05} value={filterVals.brightness} onChange={(e) => updateFilter(mediaSel.id, Number(e.target.value), filterVals.contrast, filterVals.saturate)} className="w-16" />
                      </label>
                      <label className="flex items-center gap-1.5">
                        {t('studio.contrast')}
                        <input type="range" min={0.5} max={1.5} step={0.05} value={filterVals.contrast} onChange={(e) => updateFilter(mediaSel.id, filterVals.brightness, Number(e.target.value), filterVals.saturate)} className="w-16" />
                      </label>
                      <label className="flex items-center gap-1.5">
                        {t('studio.saturate')}
                        <input type="range" min={0} max={2} step={0.1} value={filterVals.saturate} onChange={(e) => updateFilter(mediaSel.id, filterVals.brightness, filterVals.contrast, Number(e.target.value))} className="w-16" />
                      </label>
                    </>
                  )}
                  {textSel && (
                    <>
                      <input
                        value={textSel.text}
                        onChange={(e) => updateText(textSel.id, { text: e.target.value })}
                        className="px-2 py-1 rounded-lg flex-1 min-w-[120px]"
                        style={{ background: C.white, color: C.text }}
                      />
                      <label className="flex items-center gap-1.5 shrink-0">
                        Aa
                        <input type="range" min={12} max={64} value={textSel.font_size} onChange={(e) => updateText(textSel.id, { font_size: Number(e.target.value) })} className="w-16" />
                      </label>
                    </>
                  )}
                  <div className="flex items-center gap-1 ms-auto shrink-0">
                    <button type="button" onClick={() => reorderSelected('back')} title={t('studio.sendToBack')} className="px-2 py-1 rounded-lg" style={{ background: C.white, color: C.text }}>⬇</button>
                    <button type="button" onClick={() => reorderSelected('front')} title={t('studio.bringToFront')} className="px-2 py-1 rounded-lg" style={{ background: C.white, color: C.text }}>⬆</button>
                    <button type="button" onClick={deleteSelected} title={t('studio.deleteItem')} className="px-2 py-1 rounded-lg" style={{ background: C.white, color: '#c0392b' }}>
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setSelected(null)} className="px-2 py-1 rounded-lg" style={{ background: C.white, color: C.text }}>×</button>
                  </div>
                </div>
              );
            })()}

            {error && <p className="text-xs mb-2" style={{ color: '#c0392b' }}>{error}</p>}

            <div
              ref={containerRef}
              className="relative w-full touch-none select-none"
              onPointerMove={onContainerPointerMove}
              onPointerUp={() => void onContainerPointerUp()}
            >
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={() => void handlePointerUp()}
                onPointerLeave={() => void handlePointerUp()}
                className="w-full rounded-2xl touch-none block"
                style={{ background: C.white, border: `1px solid ${C.line}`, cursor: user ? (placingShape || placingText ? 'copy' : 'crosshair') : 'default' }}
              />
              {mediaItems.map((item) => (
                <div
                  key={item.id}
                  onPointerDown={(e) => startDrag('media', item, 'move', e)}
                  className="absolute rounded-lg overflow-hidden cursor-move"
                  style={{
                    left: `${(item.x / CANVAS_W) * 100}%`,
                    top: `${(item.y / CANVAS_H) * 100}%`,
                    width: `${(item.width / CANVAS_W) * 100}%`,
                    height: `${(item.height / CANVAS_H) * 100}%`,
                    border: `2px solid ${selected?.kind === 'media' && selected.id === item.id ? C.brownDk : C.brown}`,
                    transform: `rotate(${item.rotation}deg)`,
                    zIndex: item.z_index,
                  }}
                >
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" className="w-full h-full object-cover pointer-events-none" style={{ filter: item.filter || undefined }} draggable={false} />
                  )}
                  <span
                    onPointerDown={(e) => startDrag('media', item, 'resize', e)}
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
                    style={{ background: C.brown, borderRadius: '4px 0 4px 0' }}
                  />
                  {isLive && (
                    <span
                      onPointerDown={(e) => startDrag('media', item, 'rotate', e)}
                      title={t('studio.rotate')}
                      className="absolute -top-2 -right-2 w-4 h-4 rounded-full cursor-grab"
                      style={{ background: C.brownDk, border: `2px solid ${C.white}` }}
                    />
                  )}
                </div>
              ))}
              {isLive && shapes.map((shape) => (
                <div
                  key={shape.id}
                  onPointerDown={(e) => startDrag('shape', shape, 'move', e)}
                  className="absolute cursor-move"
                  style={{
                    left: `${(shape.x / CANVAS_W) * 100}%`,
                    top: `${(shape.y / CANVAS_H) * 100}%`,
                    width: `${(shape.width / CANVAS_W) * 100}%`,
                    height: `${(shape.height / CANVAS_H) * 100}%`,
                    transform: `rotate(${shape.rotation}deg)`,
                    background: shape.kind === 'line' ? shape.color : 'transparent',
                    border: shape.kind === 'line' ? undefined : `${shape.stroke_width}px solid ${shape.color}`,
                    borderRadius: shape.kind === 'circle' ? '50%' : shape.kind === 'rectangle' ? 6 : 0,
                    zIndex: shape.z_index,
                    outline: selected?.kind === 'shape' && selected.id === shape.id ? `2px dashed ${C.brownDk}` : undefined,
                  }}
                >
                  <span
                    onPointerDown={(e) => startDrag('shape', shape, 'resize', e)}
                    className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize"
                    style={{ background: C.brown, borderRadius: '4px 0 4px 0' }}
                  />
                  <span
                    onPointerDown={(e) => startDrag('shape', shape, 'rotate', e)}
                    title={t('studio.rotate')}
                    className="absolute -top-2 -right-2 w-3 h-3 rounded-full cursor-grab"
                    style={{ background: C.brownDk, border: `2px solid ${C.white}` }}
                  />
                </div>
              ))}
              {isLive && texts.map((item) => (
                <div
                  key={item.id}
                  onPointerDown={(e) => startDrag('text', item, 'move', e)}
                  className="absolute cursor-move flex items-center px-1 whitespace-nowrap overflow-hidden"
                  style={{
                    left: `${(item.x / CANVAS_W) * 100}%`,
                    top: `${(item.y / CANVAS_H) * 100}%`,
                    width: `${(item.width / CANVAS_W) * 100}%`,
                    height: `${(item.height / CANVAS_H) * 100}%`,
                    transform: `rotate(${item.rotation}deg)`,
                    zIndex: item.z_index,
                    color: item.color,
                    fontSize: item.font_size,
                    fontWeight: 700,
                    border: selected?.kind === 'text' && selected.id === item.id ? `1px dashed ${C.brownDk}` : '1px dashed transparent',
                  }}
                >
                  {item.text}
                  <span
                    onPointerDown={(e) => startDrag('text', item, 'resize', e)}
                    className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize"
                    style={{ background: C.brown, borderRadius: '4px 0 4px 0' }}
                  />
                  <span
                    onPointerDown={(e) => startDrag('text', item, 'rotate', e)}
                    title={t('studio.rotate')}
                    className="absolute -top-2 -right-2 w-3 h-3 rounded-full cursor-grab"
                    style={{ background: C.brownDk, border: `2px solid ${C.white}` }}
                  />
                </div>
              ))}
            </div>
            {!user && <p className="text-xs mt-2" style={{ color: C.text2 }}>{t('studio.signInToDraw')}</p>}

            {isLive && chatOpen && (
              <div className="mt-3 rounded-2xl p-3" style={{ background: C.card2 }}>
                <div className="max-h-40 overflow-y-auto space-y-1.5 mb-2">
                  {chatMessages.length === 0 ? (
                    <p className="text-xs" style={{ color: C.text2 }}>—</p>
                  ) : (
                    chatMessages.map((m, i) => (
                      <p key={i} className="text-xs" style={{ color: C.text }}>
                        <span className="font-semibold" style={{ color: C.brownDk }}>{m.user?.username ?? '?'}:</span> {m.text}
                      </p>
                    ))
                  )}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={t('studio.chatPlaceholder')}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: C.white, color: C.text }}
                  />
                  <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: C.brownDk }}>→</button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </WorldShell>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioPageInner />
    </Suspense>
  );
}
