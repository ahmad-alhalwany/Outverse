'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaceSmileIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { MdGif } from 'react-icons/md';
import { FaSpinner } from 'react-icons/fa';
import { useLocale } from '../LocaleProvider';
import type { PickerMediaItem } from '@/lib/pickerFallback';

const EmojiPicker = dynamic(
  () =>
    import('@emoji-mart/react').then((mod) =>
      import('@emoji-mart/data').then((emojiData) => {
        const Picker = mod.default;
        function MartPicker({
          theme,
          onSelect,
        }: {
          theme: 'dark' | 'light';
          onSelect: (native: string) => void;
        }) {
          return (
            <Picker
              data={emojiData.default}
              onEmojiSelect={(e: { native: string }) => onSelect(e.native)}
              theme={theme}
              previewPosition="none"
              skinTonePosition="search"
              searchPosition="sticky"
              maxFrequentRows={2}
              perLine={9}
              emojiSize={22}
              emojiButtonSize={34}
            />
          );
        }
        return MartPicker;
      }),
    ),
  {
    ssr: false,
    loading: () => (
      <div className="comment-picker__loading">
        <FaSpinner className="animate-spin h-6 w-6" />
      </div>
    ),
  },
);

export type PickerTab = 'emoji' | 'gif' | 'sticker';

const PICKER_WIDTH = 352;
const PICKER_EST_HEIGHT = 340;

type PickerCoords = {
  left: number;
  top: number;
  width: number;
  placement: 'above' | 'below';
};

interface CommentMediaPickerProps {
  tab: PickerTab | null;
  anchorRef: RefObject<HTMLElement | null>;
  onTabChange: (tab: PickerTab | null) => void;
  onEmoji: (native: string) => void;
  onGif: (url: string) => void;
  onSticker: (url: string) => void;
}

function computeCoords(anchor: HTMLElement): PickerCoords {
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(PICKER_WIDTH, window.innerWidth - 16);
  let left = rect.left;
  if (left + width > window.innerWidth - 8) {
    left = window.innerWidth - width - 8;
  }
  if (left < 8) left = 8;

  const spaceAbove = rect.top;
  const placeBelow = spaceAbove < PICKER_EST_HEIGHT + 12;
  const top = placeBelow ? rect.bottom + 8 : rect.top - 8;

  return { left, top, width, placement: placeBelow ? 'below' : 'above' };
}

async function fetchMedia(type: 'gif' | 'sticker', q: string): Promise<{
  items: PickerMediaItem[];
  hint?: string;
}> {
  const params = new URLSearchParams({ type });
  if (q) params.set('q', q);
  const res = await fetch(`/api/picker/media?${params}`);
  if (!res.ok) throw new Error('fetch failed');
  return res.json();
}

export default function CommentMediaPicker({
  tab,
  anchorRef,
  onTabChange,
  onEmoji,
  onGif,
  onSticker,
}: CommentMediaPickerProps) {
  const { t, locale } = useLocale();
  const panelRef = useRef<HTMLDivElement>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [coords, setCoords] = useState<PickerCoords | null>(null);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<PickerMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | undefined>();
  const [emojiTheme, setEmojiTheme] = useState<'dark' | 'light'>('dark');

  const mediaType = tab === 'sticker' ? 'sticker' : 'gif';

  const loadMedia = useCallback(async (q: string) => {
    if (tab !== 'gif' && tab !== 'sticker') return;
    setLoading(true);
    try {
      const data = await fetchMedia(mediaType, q);
      setItems(data.items);
      setHint(data.hint);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, mediaType]);

  useEffect(() => {
    setEmojiTheme(
      typeof document !== 'undefined' &&
        document.documentElement.classList.contains('light')
        ? 'light'
        : 'dark',
    );
  }, [tab]);

  useEffect(() => {
    if (tab !== 'gif' && tab !== 'sticker') return;
    setSearch('');
    loadMedia('');
  }, [tab, loadMedia]);

  useEffect(() => {
    if (tab !== 'gif' && tab !== 'sticker') return;
    const timer = setTimeout(() => loadMedia(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search, tab, loadMedia]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!tab || !anchorRef.current) {
      setCoords(null);
      return;
    }
    setCoords(computeCoords(anchorRef.current));
  }, [tab, anchorRef]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition, tab]);

  useEffect(() => {
    if (!tab) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [tab, updatePosition]);

  useEffect(() => {
    if (!tab) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onTabChange(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [tab, onTabChange, anchorRef]);

  const tabs: { id: PickerTab; label: string; icon: React.ReactNode }[] = [
    { id: 'emoji', label: t('picker.emoji'), icon: <FaceSmileIcon className="h-4 w-4" /> },
    { id: 'gif', label: t('picker.gif'), icon: <MdGif className="h-4 w-4" /> },
    { id: 'sticker', label: t('picker.sticker'), icon: <span className="text-sm">🌟</span> },
  ];

  const panel =
    tab && coords ? (
      <motion.div
        ref={panelRef}
        className={`comment-picker comment-picker--floating comment-picker--${coords.placement}`}
        style={{
          position: 'fixed',
          left: coords.left,
          top: coords.top,
          width: coords.width,
          zIndex: 10050,
          transform: coords.placement === 'above' ? 'translateY(-100%)' : undefined,
        }}
        initial={{ opacity: 0, y: coords.placement === 'above' ? 10 : -10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: coords.placement === 'above' ? 8 : -8, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-label={t('picker.title')}
      >
          <div className="comment-picker__header">
            <div className="comment-picker__tabs" role="tablist">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  className={`comment-picker__tab${tab === item.id ? ' comment-picker__tab--active' : ''}`}
                  onClick={() => onTabChange(item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="comment-picker__close"
              onClick={() => onTabChange(null)}
              aria-label={t('picker.close')}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {(tab === 'gif' || tab === 'sticker') && (
            <div className="comment-picker__search">
              <MagnifyingGlassIcon className="h-4 w-4 shrink-0 opacity-60" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  tab === 'sticker'
                    ? t('picker.searchStickers')
                    : t('picker.searchGifs')
                }
                className="comment-picker__search-input"
                autoFocus
              />
            </div>
          )}

          <div className="comment-picker__body">
            {tab === 'emoji' && (
              <div className="comment-picker__emoji-wrap" key={locale}>
                <EmojiPicker
                  theme={emojiTheme}
                  onSelect={(native) => {
                    onEmoji(native);
                    onTabChange(null);
                  }}
                />
              </div>
            )}

            {(tab === 'gif' || tab === 'sticker') && (
              <>
                {loading && (
                  <div className="comment-picker__loading">
                    <FaSpinner className="animate-spin h-6 w-6" />
                    <span>{t('picker.loading')}</span>
                  </div>
                )}
                {!loading && items.length === 0 && (
                  <p className="comment-picker__empty">{t('picker.noResults')}</p>
                )}
                {!loading && items.length > 0 && (
                  <div className="comment-picker__grid">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="comment-picker__tile"
                        onClick={() => {
                          if (tab === 'gif') onGif(item.url);
                          else onSticker(item.url);
                          onTabChange(null);
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.preview}
                          alt=""
                          loading="lazy"
                          className="comment-picker__tile-img"
                        />
                      </button>
                    ))}
                  </div>
                )}
                {hint && !loading && (
                  <p className="comment-picker__hint">{hint}</p>
                )}
              </>
            )}
          </div>
      </motion.div>
    ) : null;

  if (!portalReady || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>{panel}</AnimatePresence>,
    document.body,
  );
}
