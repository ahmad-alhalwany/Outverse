'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  PaperAirplaneIcon,
  Squares2X2Icon,
  ViewfinderCircleIcon,
  GlobeAltIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { VaultMapMarker } from './EmotionVaultMapInner';
import CosmicStarfieldOverlay from './CosmicStarfieldOverlay';
import {
  persistVaultMapStyle,
  readVaultMapStyle,
  toggleVaultMapStyle,
  type VaultMapStyle,
} from '@/lib/vaultMapStyle';

export type { VaultMapStyle };

const MapInner = dynamic(() => import('./EmotionVaultMapInner'), {
  ssr: false,
  loading: () => (
    <div className="vault-map-loading flex items-center justify-center h-full w-full">
      <span className="text-sm opacity-70">Loading map…</span>
    </div>
  ),
});

export type { VaultMapMarker };

type VaultColors = {
  brown: string;
  brownDk: string;
  white: string;
  text: string;
  text2: string;
  line: string;
  btnShadow: string;
};

type Props = {
  markers: VaultMapMarker[];
  variant: 'light' | 'dark';
  colors: VaultColors;
  height?: number | string;
  onThrow: () => void;
  onCatch: () => void;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  flyTarget?: { lat: number; lng: number; zoom: number } | null;
  onFlyTargetChange?: (t: { lat: number; lng: number; zoom: number } | null) => void;
  mapStyle?: VaultMapStyle;
  onMapStyleChange?: (s: VaultMapStyle) => void;
};

export default function EmotionVaultMap({
  markers,
  variant,
  colors: C,
  height = 480,
  onThrow,
  onCatch,
  searchQuery: controlledQuery,
  onSearchQueryChange,
  flyTarget: controlledFly,
  onFlyTargetChange,
  mapStyle: controlledMapStyle,
  onMapStyleChange,
}: Props) {
  const [internalQuery, setInternalQuery] = useState('');
  const query = controlledQuery ?? internalQuery;
  const setQuery = onSearchQueryChange ?? setInternalQuery;
  const [internalFly, setInternalFly] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const flyTarget = controlledFly ?? internalFly;
  const setFlyTarget = onFlyTargetChange ?? setInternalFly;
  const [internalMapStyle, setInternalMapStyle] = useState<VaultMapStyle>(() =>
    typeof window !== 'undefined' ? readVaultMapStyle() : 'street',
  );
  const mapStyle = controlledMapStyle ?? internalMapStyle;
  const setMapStyle = onMapStyleChange ?? setInternalMapStyle;
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    persistVaultMapStyle(mapStyle);
  }, [mapStyle]);

  const isCosmic = mapStyle === 'cosmic';

  function handleToggleMapStyle() {
    setMapStyle(toggleVaultMapStyle(mapStyle));
  }

  const onMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
  }, []);

  const searchLocation = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    const { searchLocation: geocodeSearch } = await import('@/lib/geocode');
    const target = await geocodeSearch(q);
    if (target) setFlyTarget(target);
  }, [query, setFlyTarget]);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFlyTarget({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          zoom: 11,
        });
      },
      () => {},
      { timeout: 8000 },
    );
  }, [setFlyTarget]);

  return (
    <div
      className={`vault-map-panel relative rounded-2xl overflow-hidden${isCosmic ? ' vault-map-panel--cosmic' : ''}`}
      style={{
        height,
        border: `1px solid ${isCosmic ? 'rgba(120, 140, 255, 0.25)' : C.line}`,
        boxShadow: isCosmic
          ? '0 4px 32px rgba(60, 40, 120, 0.35), inset 0 0 80px rgba(20, 10, 50, 0.2)'
          : '0 4px 24px rgba(0,0,0,0.08)',
      }}
    >
      <MapInner
        markers={markers}
        variant={variant}
        mapStyle={mapStyle}
        flyTarget={flyTarget}
        onMapReady={onMapReady}
        className="h-full w-full"
      />

      {isCosmic && <CosmicStarfieldOverlay />}

      <div className="absolute top-4 left-4 right-4 z-[500] flex flex-wrap items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={handleToggleMapStyle}
          className={`vault-map-style-toggle${isCosmic ? ' vault-map-style-toggle--cosmic' : ''}`}
          aria-label={isCosmic ? 'Switch to street map' : 'Switch to cosmic map'}
          title={isCosmic ? 'Street map' : 'Cosmic map'}
        >
          {isCosmic ? (
            <>
              <GlobeAltIcon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Street map</span>
            </>
          ) : (
            <>
              <SparklesIcon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Cosmic map</span>
            </>
          )}
        </button>

        <div className="flex flex-1 min-w-[12rem] gap-2 sm:max-w-md sm:ml-auto">
        <div className="relative flex-1">
          <MagnifyingGlassIcon
            className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: C.text2 }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchLocation()}
            placeholder="Search for a place…"
            className="vault-map-search w-full pl-9 pr-3 py-2.5 text-sm rounded-xl outline-none shadow-sm"
            style={{ background: C.white, color: C.text, border: `1px solid ${C.line}` }}
          />
        </div>
        <button
          type="button"
          onClick={searchLocation}
          className="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-sm"
          style={{ background: C.brownDk }}
        >
          Search
        </button>
        </div>
      </div>

      <div className="vault-map-zoom-stack absolute bottom-[7.5rem] lg:bottom-4 right-4 z-[500] flex flex-col gap-1.5">
        <button
          type="button"
          className="vault-map-ctrl-btn"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Zoom in"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="vault-map-ctrl-btn"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Zoom out"
        >
          <MinusIcon className="h-5 w-5" />
        </button>
        <button type="button" className="vault-map-ctrl-btn" onClick={locateMe} aria-label="My location">
          <ViewfinderCircleIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="vault-map-actions absolute bottom-4 right-4 z-[500] flex flex-col gap-2 w-44 sm:w-52 pointer-events-auto">
          <button
            type="button"
            onClick={onThrow}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm text-white transition hover:scale-[1.02]"
            style={{ background: C.brownDk, boxShadow: C.btnShadow }}
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            Throw bottle
          </button>
          <button
            type="button"
            onClick={onCatch}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition hover:scale-[1.02]"
            style={{ background: C.white, color: C.text, border: `1px solid ${C.line}` }}
          >
            <Squares2X2Icon className="h-4 w-4" />
            Catch bottle
          </button>
      </div>

      {markers.length === 0 && (
        <div className="absolute inset-0 z-[400] pointer-events-none flex items-center justify-center p-8">
          <p
            className="text-sm font-medium text-center px-4 py-2 rounded-full shadow-sm max-w-xs"
            style={{ background: `${C.white}ee`, color: C.text2 }}
          >
            Throw a bottle with location — it drifts on the map for 24 hours
          </p>
        </div>
      )}
    </div>
  );
}
