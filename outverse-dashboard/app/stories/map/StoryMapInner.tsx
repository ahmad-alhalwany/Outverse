'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { StoryMapPin } from './page';
import 'leaflet/dist/leaflet.css';

function storyIcon(hasThumbnail: boolean) {
  return L.divIcon({
    className: 'story-map-pin-wrapper',
    html: `<div class="vault-bottle-pin vault-bottle-pin--cosmic" style="--pin-color:#7C3AED"><span class="vault-bottle-pin__ring"></span><span class="vault-bottle-pin__emoji">${hasThumbnail ? '📸' : '✨'}</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
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
      map.fitBounds(L.latLngBounds(pins.map((pin) => [pin.lat, pin.lng])).pad(0.25), {
        maxZoom: 12,
      });
    }
    fittedKey.current = key;
  }, [key, map, pins]);

  return null;
}

function StoryMarker({ pin }: { pin: StoryMapPin }) {
  const icon = useMemo(() => storyIcon(!!pin.thumbnail), [pin.thumbnail]);

  return (
    <Marker position={[pin.lat, pin.lng]} icon={icon}>
      <Popup className="vault-map-popup vault-map-popup--cosmic">
        <div className="vault-map-popup-inner max-w-[230px]">
          {pin.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pin.thumbnail} alt="" className="mb-2 h-28 w-full rounded-xl object-cover" />
          ) : null}
          <strong>@{pin.author}</strong>
          <p className="mt-1 text-xs opacity-75">{pin.locationName}</p>
          {pin.text ? <p className="mt-2 line-clamp-3 text-sm">{pin.text}</p> : null}
          <Link href={`/?story=${pin.id}`} className="mt-3 inline-flex rounded-full bg-vault px-3 py-1.5 text-xs font-bold text-white">
            Open story
          </Link>
        </div>
      </Popup>
    </Marker>
  );
}

export default function StoryMapInner({ pins }: { pins: StoryMapPin[] }) {
  const center: [number, number] = pins.length ? [pins[0].lat, pins[0].lng] : [20, 0];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-surface shadow-sm">
      <MapContainer
        center={center}
        zoom={pins.length ? 4 : 2}
        className="vault-leaflet-map vault-leaflet-map--cosmic h-[560px] w-full"
        scrollWheelZoom
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO'
        />
        <FitBounds pins={pins} />
        {pins.map((pin) => (
          <StoryMarker key={pin.id} pin={pin} />
        ))}
      </MapContainer>
      {pins.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[450] flex items-center justify-center bg-black/20 px-4 text-center text-sm font-semibold text-white">
          No mapped stories yet. Stories with a location will appear here.
        </div>
      )}
    </div>
  );
}
