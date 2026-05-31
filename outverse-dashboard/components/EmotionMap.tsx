'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { apiUrl } from '@/lib/api';
import { emotionMeta } from '@/lib/profileEmotions';

const BOTTLES_MAP_API = apiUrl('bottles/map/');

interface MapPoint {
  id: number;
  emotion_type: string;
  location_lat: number;
  location_lng: number;
  created_at: string;
}

function metaFor(emotion: string) {
  const m = emotionMeta(emotion);
  return { color: m.color, emoji: m.emoji, label: m.label };
}

export default function EmotionMap({ showLegend = true }: { showLegend?: boolean }) {
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

  const distribution = useMemo(() => {
    const counts: Record<string, number> = {};
    points.forEach((p) => {
      counts[p.emotion_type] = (counts[p.emotion_type] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [points]);

  const gridLines = [];
  for (let lng = 30; lng < 360; lng += 30) {
    gridLines.push(
      <line key={`v-${lng}`} x1={lng} y1={0} x2={lng} y2={180} stroke="currentColor" strokeWidth={0.3} opacity={0.18} />
    );
  }
  for (let lat = 30; lat < 180; lat += 30) {
    gridLines.push(
      <line key={`h-${lat}`} x1={0} y1={lat} x2={360} y2={lat} stroke="currentColor" strokeWidth={0.3} opacity={0.18} />
    );
  }

  return (
    <div>
      <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-[#0b0b22] to-[#1b1340] aspect-[2/1] text-white/40">
        <svg viewBox="0 0 360 180" preserveAspectRatio="none" className="w-full h-full">
          <ellipse cx={180} cy={90} rx={178} ry={88} fill="none" stroke="currentColor" strokeWidth={0.4} opacity={0.25} />
          {gridLines}
          {points.map((p) => {
            const x = p.location_lng + 180;
            const y = 90 - p.location_lat;
            const { color } = metaFor(p.emotion_type);
            return (
              <g key={p.id}>
                <circle cx={x} cy={y} r={4} fill={color} opacity={0.25}>
                  <animate attributeName="r" values="3;6;3" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0.05;0.3" dur="3s" repeatCount="indefinite" />
                </circle>
                <circle cx={x} cy={y} r={1.8} fill={color} />
              </g>
            );
          })}
        </svg>
        {!loading && points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/50">
            No emotions mapped yet
          </div>
        )}
        <div className="absolute bottom-1 right-2 text-[10px] text-white/60">
          {points.length} {points.length === 1 ? 'emotion' : 'emotions'} worldwide
        </div>
      </div>

      {showLegend && distribution.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {distribution.map(([emotion, count]) => {
            const { color, emoji, label } = metaFor(emotion);
            return (
              <span key={emotion} className="flex items-center gap-1 text-[11px] text-text-secondary">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                {emoji} {label} <span className="text-text/70">{count}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
