'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { StoryMapPin } from './page';
import { useLocale } from '@/components/LocaleProvider';
import 'leaflet/dist/leaflet.css';

function storyIcon(hasThumbnail: boolean) {
  return L.divIcon({
    className: 'story-map-pin-wrapper',
    html: `<div class="story-map-pin">${hasThumbnail ? '📸' : '✨'}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function FitBounds({ pins }: { pins: StoryMapPin[] }) {
  const map = useMap();
  const fittedKey = useRef('');
  const key = pins.map((pin) => pin.id).join(',');

  useEffect(() => {
    if (!pins.length || fittedKey.current === key) return;
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 10);
    } else {
      map.fitBounds(L.latLngBounds(pins.map((pin) => [pin.lat, pin.lng])).pad(0.28), {
        maxZoom: 11,
      });
    }
    fittedKey.current = key;
  }, [key, map, pins]);

  return null;
}

function StoryMarker({ pin }: { pin: StoryMapPin }) {
  const { t } = useLocale();
  const icon = useMemo(() => storyIcon(!!pin.thumbnail), [pin.thumbnail]);

  return (
    <Marker position={[pin.lat, pin.lng]} icon={icon}>
      <Popup className="story-map-popup">
        <div className="max-w-[230px]">
          {pin.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pin.thumbnail} alt="" className="mb-2 h-28 w-full rounded-xl object-cover" />
          ) : null}
          <strong style={{ color: '#fff', fontSize: '0.95rem' }}>@{pin.author}</strong>
          <p className="mt-1 text-xs font-bold" style={{ color: '#67e8f9' }}>{pin.locationName}</p>
          {pin.text ? (
            <p className="mt-2 line-clamp-3 text-sm" style={{ color: '#e2e8f0' }}>{pin.text}</p>
          ) : null}
          <Link href={`/?story=${pin.id}`} className="story-map-popup-cta">
            {t('storyMap.openStory')}
          </Link>
        </div>
      </Popup>
    </Marker>
  );
}

export default function StoryMapInner({ pins }: { pins: StoryMapPin[] }) {
  const { t } = useLocale();
  const center: [number, number] = pins.length ? [pins[0].lat, pins[0].lng] : [25, 30];

  return (
    <div className="story-map-frame">
      <MapContainer
        center={center}
        zoom={pins.length ? 4 : 2}
        className="h-[min(62vh,620px)] w-full"
        scrollWheelZoom
        zoomControl={false}
      >
        {/* Colorful readable basemap — land/ocean clearly visible */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO'
        />
        <FitBounds pins={pins} />
        {pins.map((pin) => (
          <StoryMarker key={pin.id} pin={pin} />
        ))}
      </MapContainer>
      {pins.length === 0 && (
        <div className="story-map-empty">
          {t('storyMap.emptyMap')}
        </div>
      )}
    </div>
  );
}
