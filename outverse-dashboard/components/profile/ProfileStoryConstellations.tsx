'use client';

import { useEffect, useState } from 'react';
import {
  fetchUserConstellations,
  fetchConstellationStories,
  createConstellation,
  addStoryToConstellation,
  fetchStoryArchive,
  type StoryConstellation,
  type StoryItem,
} from '@/lib/storyUtils';
import { StoryModal } from '@/components/StoriesSidebar';
import { useLocale } from '@/components/LocaleProvider';

/** Permanent story collections — Cosmory Constellations (manual Highlights). */
export default function ProfileStoryConstellations({
  userId,
  isOwner = false,
}: {
  userId: string | number;
  isOwner?: boolean;
}) {
  const { t, locale } = useLocale();
  const [constellations, setConstellations] = useState<StoryConstellation[]>([]);
  const [playlist, setPlaylist] = useState<StoryItem[]>([]);
  const [showStory, setShowStory] = useState<StoryItem | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [pickingFor, setPickingFor] = useState<number | null>(null);
  const [archive, setArchive] = useState<StoryItem[]>([]);

  const reload = () => {
    const id = Number(userId);
    if (!id) return;
    fetchUserConstellations(id).then(setConstellations);
  };

  useEffect(() => {
    reload();
  }, [userId]);

  const openConstellation = async (id: number) => {
    const { items } = await fetchConstellationStories(id);
    if (items.length === 0) return;
    setPlaylist(items);
    setShowStory(items[0]);
  };

  const create = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    const created = await createConstellation(draft.trim());
    setBusy(false);
    if (created) {
      setDraft('');
      reload();
    }
  };

  const startAdd = async (constellationId: number) => {
    setBusy(true);
    const items = await fetchStoryArchive();
    setBusy(false);
    setArchive(items);
    setPickingFor(constellationId);
  };

  const pinStory = async (storyId: number) => {
    if (!pickingFor) return;
    setBusy(true);
    const ok = await addStoryToConstellation(pickingFor, storyId);
    setBusy(false);
    if (ok) {
      setPickingFor(null);
      reload();
    }
  };

  if (constellations.length === 0 && !isOwner) return null;

  const idx = showStory ? playlist.findIndex((s) => s.id === showStory.id) : -1;
  const isEn = locale === 'en';

  return (
    <>
      <div className="profile-constellations-row">
        {isOwner ? (
          <div className="profile-constellation-create">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={isEn ? 'Name…' : 'اسم…'}
              className="profile-constellation-input"
              maxLength={40}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void create();
              }}
            />
            <button
              type="button"
              className="profile-constellation-add"
              onClick={() => void create()}
              disabled={busy || !draft.trim()}
              aria-label={isEn ? 'Create constellation' : 'إنشاء كوكبة'}
            >
              +
            </button>
          </div>
        ) : null}

        {constellations.map((c) => (
          <div key={c.id} className="profile-constellation-chip">
            <button type="button" className="profile-constellation-chip" onClick={() => openConstellation(c.id)}>
              <span className="profile-constellation-cover">
                {c.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover} alt={c.title} />
                ) : (
                  <span className="profile-constellation-cover--empty">✨</span>
                )}
              </span>
              <span className="profile-constellation-label text-text-secondary">{c.title}</span>
            </button>
            {isOwner ? (
              <button
                type="button"
                className="profile-constellation-manage"
                onClick={() => void startAdd(c.id)}
                disabled={busy}
              >
                {isEn ? '+ Story' : '+ قصة'}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {pickingFor != null ? (
        <div className="profile-constellation-archive-modal" role="dialog" aria-modal="true">
          <div className="profile-constellation-archive-panel">
            <div className="profile-constellation-archive-head">
              <h3>{isEn ? 'Pin from archive' : 'تثبيت من الأرشيف'}</h3>
              <button type="button" onClick={() => setPickingFor(null)}>
                {isEn ? 'Close' : 'إغلاق'}
              </button>
            </div>
            <div className="profile-constellation-archive-grid">
              {archive.length === 0 ? (
                <p className="text-sm opacity-60">{isEn ? 'No archived stories yet.' : 'لا توجد قصص في الأرشيف.'}</p>
              ) : (
                archive.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="profile-constellation-archive-item"
                    onClick={() => void pinStory(s.id)}
                    disabled={busy}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.mediaUrl || ''} alt="" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showStory && (
        <StoryModal
          story={showStory}
          onClose={() => setShowStory(null)}
          onPrev={() => idx > 0 && setShowStory(playlist[idx - 1])}
          onNext={() => idx < playlist.length - 1 && setShowStory(playlist[idx + 1])}
          hasPrev={idx > 0}
          hasNext={idx < playlist.length - 1}
        />
      )}
    </>
  );
}
