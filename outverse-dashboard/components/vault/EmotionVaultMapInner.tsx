'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { formatBottleTimeLeft } from '@/utils/bottleTime';
import 'leaflet/dist/leaflet.css';
import MapZoomBridgeInner from './MapZoomBridgeInner';
import type { VaultMapStyle } from '@/lib/vaultMapStyle';

export type VaultMapMarker = {
  id: number | string;
  lat: number;
  lng: number;
  color: string;
  emoji: string;
  label?: string;
  expiresAt?: string;
  isMine?: boolean;
  message?: string | null;
  showOwnMessage?: boolean;
};

function bottleDivIcon(emoji: string, color: string, cosmic: boolean, isMine: boolean) {
  const mine = isMine ? ' vault-bottle-pin--mine' : '';
  return L.divIcon({
    className: 'vault-bottle-pin-wrapper',
    html: `<div class="vault-bottle-pin${cosmic ? ' vault-bottle-pin--cosmic' : ''}${mine}" style="--pin-color:${color}"><span class="vault-bottle-pin__ring"></span><span class="vault-bottle-pin__emoji">${emoji}</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

type FlyTarget = { lat: number; lng: number; zoom: number } | null;

function MapFlyTo({ target }: { target: FlyTarget }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom, { duration: 1.1 });
  }, [target, map]);
  return null;
}

function FitBoundsOnMarkers({ markers }: { markers: VaultMapMarker[] }) {
  const map = useMap();
  const key = markers.map((m) => m.id).join(',');
  const fittedKey = useRef<string | null>(null);
  useEffect(() => {
    if (markers.length === 0) return;
    if (fittedKey.current === key) return;
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 6);
    } else {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
      map.fitBounds(bounds.pad(0.25), { maxZoom: 10 });
    }
    fittedKey.current = key;
  }, [key, markers, map]);
  return null;
}

function BottleMapMarker({ marker: m, cosmic }: { marker: VaultMapMarker; cosmic: boolean }) {
  const isMine = !!m.isMine;
  const icon = useMemo(
    () => bottleDivIcon(m.emoji, m.color, cosmic, isMine),
    [m.emoji, m.color, cosmic, isMine],
  );
  const timeLeft = m.expiresAt ? formatBottleTimeLeft(m.expiresAt) : null;
  const showMessage =
    isMine && m.showOwnMessage !== false && m.message && m.message.trim().length > 0;

  return (
    <Marker position={[m.lat, m.lng]} icon={icon}>
      <Popup className={`vault-map-popup${cosmic ? ' vault-map-popup--cosmic' : ''}`}>
        <div className="vault-map-popup-inner">
          {isMine && (
            <span
              className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1"
              style={{ background: 'rgba(160,86,59,0.2)', color: '#a0563b' }}
            >
              Your bottle
            </span>
          )}
          <div className="text-lg leading-none mb-1">{m.emoji} 🍶</div>
          <strong>{m.label || 'Mood'}</strong>
          {showMessage ? (
            <p className="text-sm mt-2 leading-relaxed max-w-[220px] whitespace-pre-wrap">
              {m.message}
            </p>
          ) : (
            !isMine && (
              <p className="text-xs mt-2 opacity-75">
                Catch a bottle to read strangers&apos; messages
              </p>
            )
          )}
          {timeLeft && (
            <p className="vault-map-popup-ttl text-xs mt-2 opacity-80">
              Vanishes in {timeLeft}
            </p>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

type Props = {
  markers: VaultMapMarker[];
  variant: 'light' | 'dark';
  mapStyle: VaultMapStyle;
  flyTarget: FlyTarget;
  className?: string;
  onMapReady?: (map: L.Map) => void;
};

function tileFor(variant: 'light' | 'dark', mapStyle: VaultMapStyle) {
  if (mapStyle === 'cosmic') {
    return {
      url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
    };
  }
  return variant === 'dark'
    ? {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
      }
    : {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
      };
}

export default function EmotionVaultMapInner({
  markers,
  variant,
  mapStyle,
  flyTarget,
  className = '',
  onMapReady,
}: Props) {
  const defaultCenter: [number, number] = markers.length
    ? [markers[0].lat, markers[0].lng]
    : [20, 0];
  const defaultZoom = markers.length ? 3 : 2;

  const tile = useMemo(() => tileFor(variant, mapStyle), [variant, mapStyle]);
  const cosmic = mapStyle === 'cosmic';

  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      className={`vault-leaflet-map vault-leaflet-map--${mapStyle} ${className}`}
      scrollWheelZoom
      zoomControl={false}
    >
      <TileLayer key={mapStyle} url={tile.url} attribution={tile.attribution} />
      {onMapReady && <MapZoomBridgeInner onMap={(m) => onMapReady(m as L.Map)} />}
      <FitBoundsOnMarkers markers={markers} />
      <MapFlyTo target={flyTarget} />
      {markers.map((m) => (
        <BottleMapMarker key={m.id} marker={m} cosmic={cosmic} />
      ))}
    </MapContainer>
  );
}
