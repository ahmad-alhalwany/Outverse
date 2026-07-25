'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch, apiFetchJson, apiUrl } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

const BASE = apiUrl('speculative/draw-sessions');

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

type Stroke = { points: { x: number; y: number }[]; color: string };
type Session = { id: number; title: string; host: { username: string }; strokes: Stroke[] };

export default function StudioPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const user = useAuthUser();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState<Session | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const pendingStrokes = useRef<Stroke[]>([]);

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

  const drawAll = useCallback((strokes: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const point of stroke.points.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    if (active) drawAll(active.strokes || []);
  }, [active, drawAll]);

  async function createSession() {
    const res = await apiFetchJson('speculative/draw-sessions/', {
      method: 'POST',
      json: { title: `Session ${new Date().toLocaleTimeString()}` },
    });
    if (res.ok) {
      await loadSessions();
      setActive(await res.json());
    }
  }

  async function openSession(id: number) {
    const res = await apiFetch(`speculative/draw-sessions/${id}/`);
    if (res.ok) setActive(await res.json());
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!user || !active) return;
    setDrawing(true);
    const rect = canvasRef.current!.getBoundingClientRect();
    setCurrentStroke([{ x: event.clientX - rect.left, y: event.clientY - rect.top }]);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    setCurrentStroke((prev) => {
      const next = [...prev, point];
      drawAll([...(active?.strokes || []), ...pendingStrokes.current, { points: next, color: C.brownDk }]);
      return next;
    });
  }

  async function handlePointerUp() {
    if (!drawing || !active) return;
    setDrawing(false);
    if (currentStroke.length > 1) {
      const stroke = { points: currentStroke, color: C.brownDk };
      pendingStrokes.current = [...pendingStrokes.current, stroke];
      const res = await apiFetchJson(`speculative/draw-sessions/${active.id}/strokes/`, {
        method: 'POST',
        json: { strokes: [stroke] },
      });
      if (res.ok) {
        const updated = await res.json();
        setActive(updated);
        pendingStrokes.current = [];
      }
    }
    setCurrentStroke([]);
  }

  function clearCanvas() {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }

  return (
    <WorldShell colors={C}>
      <div className="max-w-4xl mx-auto pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: C.brown }}>🎥 {t('studio.title')}</h1>
            <p className="text-sm" style={{ color: C.text2 }}>{t('studio.subtitle')}</p>
          </div>
          {user && (
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
                  <p className="font-semibold" style={{ color: C.text }}>{session.title}</p>
                  <p className="text-xs mt-1" style={{ color: C.text2 }}>@{session.host.username}</p>
                </button>
              ))
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold" style={{ color: C.text }}>{active.title}</p>
              <div className="flex gap-2">
                <button type="button" onClick={clearCanvas} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: C.card2, color: C.brownDk }}>
                  <TrashIcon className="h-3.5 w-3.5" />
                  {t('studio.clearView')}
                </button>
                <button type="button" onClick={() => setActive(null)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: C.card2, color: C.brownDk }}>
                  {t('studio.back')}
                </button>
              </div>
            </div>
            <canvas
              ref={canvasRef}
              width={800}
              height={480}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={() => void handlePointerUp()}
              onPointerLeave={() => void handlePointerUp()}
              className="w-full rounded-2xl touch-none"
              style={{ background: C.white, border: `1px solid ${C.line}`, cursor: user ? 'crosshair' : 'default' }}
            />
            {!user && <p className="text-xs mt-2" style={{ color: C.text2 }}>{t('studio.signInToDraw')}</p>}
          </div>
        )}
      </div>
    </WorldShell>
  );
}
