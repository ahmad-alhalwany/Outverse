'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import ReelsIcon from '@/components/icons/ReelsIcon';
import ReelCreatePreview from '@/components/reels/ReelCreatePreview';
import ReelMusicTrim from '@/components/reels/ReelMusicTrim';
import type { MusicTrim } from '@/lib/reelMusicTrim';
import { apiFetch } from '@/lib/api';
import { getUser } from '@/lib/auth';
import {
  REEL_FILTER_META,
  REEL_MOOD_META,
  musicTrackPlaybackUrl,
  type ReelFilter,
  type ReelMood,
  type ReelMusicTrack,
} from '@/lib/reelTypes';
import { useLocale } from '@/components/LocaleProvider';

export default function CreateReelPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [video, setVideo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [mood, setMood] = useState<ReelMood>('cosmic');
  const [filterStyle, setFilterStyle] = useState<ReelFilter>('none');
  const [musicTrack, setMusicTrack] = useState<number | null>(null);
  const [tracks, setTracks] = useState<ReelMusicTrack[]>([]);
  const [customAudio, setCustomAudio] = useState<File | null>(null);
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  const [musicTrim, setMusicTrim] = useState<MusicTrim>({ start: 0, end: null });
  const [soundLabel, setSoundLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('reel-music/')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setTracks(Array.isArray(data) ? data : []))
      .catch(() => setTracks([]));
  }, []);

  useEffect(() => {
    if (!customAudio) {
      setCustomAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(customAudio);
    setCustomAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [customAudio]);

  const selectedTrack = tracks.find((tr) => tr.id === musicTrack) ?? null;
  const trimAudioUrl =
    customAudioUrl ||
    (selectedTrack ? musicTrackPlaybackUrl(selectedTrack) : null);
  const hasMusic = !!trimAudioUrl;

  useEffect(() => {
    if (!hasMusic) setMusicTrim({ start: 0, end: null });
  }, [hasMusic, musicTrack, customAudio]);

  const onFile = (file: File | null) => {
    setVideo(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!getUser()) {
      router.push('/login');
      return;
    }
    if (!video) {
      setError(t('reels.needVideo'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('video', video);
      fd.append('caption', caption.trim());
      fd.append('mood', mood);
      fd.append('filter_style', filterStyle);
      if (musicTrack) fd.append('music_track', String(musicTrack));
      if (customAudio) fd.append('custom_audio', customAudio);
      if (hasMusic) {
        fd.append('music_start_seconds', String(musicTrim.start));
        if (musicTrim.end != null) {
          fd.append('music_end_seconds', String(musicTrim.end));
        }
      }
      const label =
        soundLabel.trim() ||
        tracks.find((tr) => tr.id === musicTrack)?.title ||
        'Original signal';
      fd.append('sound_label', label);
      fd.append('tags', JSON.stringify([]));
      const res = await apiFetch('reels/', { method: 'POST', body: fd });
      if (res.ok) {
        router.push('/reels');
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail || t('reels.uploadFail'));
      }
    } catch {
      setError(t('reels.uploadFail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reels-create">
      <header className="reels-create__head">
        <Link href="/reels" className="reels-chrome__btn">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <h1 className="reels-create__title">
          <ReelsIcon size={22} active />
          {t('reels.createTitle')}
        </h1>
      </header>

      <form onSubmit={submit} className="reels-create__form">
        <label className="reels-create__drop">
          {preview ? (
            <ReelCreatePreview
              previewUrl={preview}
              filterStyle={filterStyle}
              musicTrack={musicTrack}
              tracks={tracks}
              customAudio={customAudio}
              musicTrim={musicTrim}
            />
          ) : (
            <span className="reels-create__drop-hint">{t('reels.dropVideo')}</span>
          )}
          <input
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0] || null)}
          />
        </label>
        {preview && (
          <p className="reels-create__preview-hint">{t('reels.previewHint')}</p>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={t('reels.captionPlaceholder')}
          rows={3}
          className="reels-create__input"
        />

        <label className="reels-create__label">{t('reels.mood')}</label>
        <div className="reels-create__moods">
          {(Object.keys(REEL_MOOD_META) as ReelMood[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`reels-create__mood${mood === m ? ' reels-create__mood--on' : ''}`}
              onClick={() => setMood(m)}
            >
              {REEL_MOOD_META[m].emoji} {REEL_MOOD_META[m].label}
            </button>
          ))}
        </div>

        <label className="reels-create__label">{t('reels.filter')}</label>
        <div className="reels-create__moods reels-create__moods--filters">
          {(Object.keys(REEL_FILTER_META) as ReelFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`reels-create__mood reels-create__filter-pill${filterStyle === f ? ' reels-create__mood--on' : ''}`}
              onClick={() => setFilterStyle(f)}
            >
              {REEL_FILTER_META[f].emoji} {REEL_FILTER_META[f].label}
            </button>
          ))}
        </div>

        <label className="reels-create__label">{t('reels.music')}</label>
        <div className="reels-create__moods reels-create__moods--music">
          <button
            type="button"
            className={`reels-create__mood${musicTrack === null && !customAudio ? ' reels-create__mood--on' : ''}`}
            onClick={() => {
              setMusicTrack(null);
              setCustomAudio(null);
            }}
          >
            {t('reels.noMusic')}
          </button>
          {tracks.map((tr) => (
            <button
              key={tr.id}
              type="button"
              className={`reels-create__mood${musicTrack === tr.id ? ' reels-create__mood--on' : ''}`}
              onClick={() => {
                setMusicTrack(tr.id);
                setCustomAudio(null);
              }}
            >
              🎵 {tr.title}
            </button>
          ))}
        </div>

        <label className="reels-create__label">{t('reels.customAudio')}</label>
        <input
          type="file"
          accept="audio/*"
          className="reels-create__input"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            setCustomAudio(f);
            if (f) setMusicTrack(null);
          }}
        />

        {hasMusic && (
          <ReelMusicTrim
            audioUrl={trimAudioUrl}
            trim={musicTrim}
            onChange={setMusicTrim}
          />
        )}

        <input
          type="text"
          value={soundLabel}
          onChange={(e) => setSoundLabel(e.target.value)}
          placeholder={t('reels.soundPlaceholder')}
          className="reels-create__input"
        />

        {error && <p className="reels-create__error">{error}</p>}

        <button type="submit" disabled={busy || !video} className="reels-create__submit">
          {busy ? t('reels.launching') : t('reels.launch')}
        </button>
      </form>
    </div>
  );
}
