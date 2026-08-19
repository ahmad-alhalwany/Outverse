'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { emotionMeta } from '@/lib/profileEmotions';
import { useLocale } from '@/components/LocaleProvider';

interface MapPoint {
  id: number;
  emotion_type: string;
  location_lat: number;
  location_lng: number;
  created_at: string;
}

/** Soft preview bottles around the Mediterranean when the vault is empty. */
const PREVIEW_BOTTLES: Array<{ id: string; emotion_type: string; location_lat: number; location_lng: number }> = [
  { id: 'p1', emotion_type: 'joy', location_lat: 41.9, location_lng: 12.5 },
  { id: 'p2', emotion_type: 'hope', location_lat: 37.98, location_lng: 23.73 },
  { id: 'p3', emotion_type: 'love', location_lat: 36.8, location_lng: 10.18 },
  { id: 'p4', emotion_type: 'mystery', location_lat: 40.4, location_lng: -3.7 },
  { id: 'p5', emotion_type: 'calm', location_lat: 43.3, location_lng: 5.4 },
  { id: 'p6', emotion_type: 'nostalgic', location_lat: 31.2, location_lng: 29.9 },
  { id: 'p7', emotion_type: 'joy', location_lat: 45.46, location_lng: 9.19 },
  { id: 'p8', emotion_type: 'hope', location_lat: 33.57, location_lng: -7.59 },
];

function metaFor(emotion: string) {
  const m = emotionMeta(emotion);
  return { color: m.color, emoji: m.emoji, labelKey: m.labelKey };
}

function project(lat: number, lng: number) {
  return { x: lng + 180, y: 90 - lat };
}

/** Simplified landmass silhouettes (equirectangular, viewBox 0 0 360 180). */
function Continents() {
  return (
    <g fill="rgba(167,139,250,0.14)" stroke="rgba(196,181,253,0.22)" strokeWidth={0.45}>
      {/* North America */}
      <path d="M48 42 C62 28, 95 30, 112 38 C120 48, 118 62, 108 70 C95 78, 78 74, 62 68 C50 58, 44 50, 48 42 Z" />
      {/* South America */}
      <path d="M108 92 C118 88, 128 96, 130 112 C128 128, 118 142, 110 148 C102 140, 98 120, 100 104 C102 96, 104 94, 108 92 Z" />
      {/* Europe */}
      <path d="M168 38 C178 32, 192 34, 198 42 C196 52, 186 56, 176 54 C168 50, 164 44, 168 38 Z" />
      {/* Africa */}
      <path d="M172 58 C186 54, 198 62, 204 78 C206 96, 198 112, 186 118 C174 114, 166 96, 166 78 C166 66, 168 60, 172 58 Z" />
      {/* Asia */}
      <path d="M198 36 C230 28, 268 34, 286 48 C292 62, 278 72, 258 74 C236 78, 214 70, 202 58 C196 48, 194 40, 198 36 Z" />
      {/* Australia */}
      <path d="M278 118 C292 114, 308 120, 312 130 C306 140, 290 142, 278 136 C272 128, 274 120, 278 118 Z" />
    </g>
  );
}

function BottleMarker({
  x,
  y,
  color,
  emoji,
  preview,
}: {
  x: number;
  y: number;
  color: string;
  emoji: string;
  preview?: boolean;
}) {
  return (
    <g opacity={preview ? 0.72 : 1}>
      <circle cx={x} cy={y} r={6} fill={color} opacity={0.18}>
        <animate attributeName="r" values="4;8;4" dur="2.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.28;0.06;0.28" dur="2.8s" repeatCount="indefinite" />
      </circle>
      <ellipse cx={x} cy={y + 1.2} rx={2.4} ry={3.2} fill={color} opacity={0.9} />
      <rect x={x - 0.7} y={y - 3.2} width={1.4} height={1.6} rx={0.4} fill={color} />
      <text x={x} y={y + 1.6} textAnchor="middle" fontSize={3.2} style={{ pointerEvents: 'none' }}>
        {emoji}
      </text>
    </g>
  );
}

export default function EmotionMap({ showLegend = true }: { showLegend?: boolean }) {
  const { t } = useLocale();
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch('bottles/map/')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active) setPoints(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const isPreview = !loading && points.length === 0;
  const displayPoints = useMemo(
    () =>
      isPreview
        ? PREVIEW_BOTTLES
        : points.map((p) => ({
            id: String(p.id),
            emotion_type: p.emotion_type,
            location_lat: p.location_lat,
            location_lng: p.location_lng,
          })),
    [isPreview, points]
  );

  const distribution = useMemo(() => {
    const counts: Record<string, number> = {};
    points.forEach((p) => {
      counts[p.emotion_type] = (counts[p.emotion_type] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [points]);

  // Focus Mediterranean when previewing; otherwise show the full globe.
  const viewBox = isPreview ? '145 35 90 70' : '0 0 360 180';

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl aspect-[2/1] text-white/40 ring-1 ring-white/8 bg-[radial-gradient(ellipse_at_30%_20%,rgba(124,58,237,0.35),transparent_55%),radial-gradient(ellipse_at_80%_80%,rgba(14,165,233,0.2),transparent_50%),linear-gradient(160deg,#07051a_0%,#14102e_55%,#0a1628_100%)]">
        <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
          <defs>
            <filter id="emotion-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <Continents />
          {/* Soft latitude / longitude hints */}
          {[60, 90, 120].map((y) => (
            <line key={`h-${y}`} x1={0} y1={y} x2={360} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.35} />
          ))}
          {[90, 180, 270].map((x) => (
            <line key={`v-${x}`} x1={x} y1={0} x2={x} y2={180} stroke="rgba(255,255,255,0.05)" strokeWidth={0.35} />
          ))}
          <g filter="url(#emotion-glow)">
            {displayPoints.map((p) => {
              const { x, y } = project(p.location_lat, p.location_lng);
              const { color, emoji } = metaFor(p.emotion_type);
              return (
                <BottleMarker key={p.id} x={x} y={y} color={color} emoji={emoji} preview={isPreview} />
              );
            })}
          </g>
        </svg>

        {isPreview && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07051a]/95 via-[#07051a]/40 to-transparent px-3 pb-2 pt-8">
            <p className="text-[11px] font-medium text-white/80">Mediterranean currents · waiting for bottles</p>
            <p className="text-[10px] text-white/45">Throw a feeling into the vault to light the map</p>
          </div>
        )}

        {!isPreview && (
          <div className="absolute bottom-1.5 right-2 rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur-sm">
            {points.length} {points.length === 1 ? 'emotion' : 'emotions'} worldwide
          </div>
        )}
      </div>

      {showLegend && !isPreview && distribution.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {distribution.map(([emotion, count]) => {
            const { color, emoji, labelKey } = metaFor(emotion);
            return (
              <span key={emotion} className="flex items-center gap-1 text-[11px] text-text-secondary">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                {emoji} {t(labelKey)} <span className="text-text/70">{count}</span>
              </span>
            );
          })}
        </div>
      )}

      {showLegend && isPreview && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {['joy', 'hope', 'love', 'mystery'].map((emotion) => {
            const { color, emoji, labelKey } = metaFor(emotion);
            return (
              <span key={emotion} className="flex items-center gap-1 text-[11px] text-text-secondary">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                {emoji} {t(labelKey)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
