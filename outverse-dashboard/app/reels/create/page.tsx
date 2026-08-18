'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import ReelsIcon from '@/components/icons/ReelsIcon';
import ReelCreatePreview from '@/components/reels/ReelCreatePreview';
import ReelMusicTrim from '@/components/reels/ReelMusicTrim';
import ReelCameraRecorder from '@/components/reels/ReelCameraRecorder';
import ReelRemixBadge from '@/components/reels/ReelRemixBadge';
import ReelGreenScreenStudio from '@/components/reels/ReelGreenScreenStudio';
import type { MusicTrim } from '@/lib/reelMusicTrim';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { remixMeaning, type RemixMeaningResult } from '@/lib/aiCoachApi';
import {
  REEL_FILTER_META,
  REEL_MOOD_META,
  musicTrackPlaybackUrl,
  type ReelFilter,
  type ReelMood,
  type ReelMusicTrack,
  type ReelTemplate,
} from '@/lib/reelTypes';
import { useLocale } from '@/components/LocaleProvider';

export default function CreateReelPage() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Defer query-param UI until after mount to avoid SSR/client hydration mismatch
  // (useSearchParams can disagree between server HTML and the first client paint).
  const [paramsReady, setParamsReady] = useState(false);
  useEffect(() => {
    setParamsReady(true);
  }, []);

  const remixOfParam = searchParams.get('remix_of');
  const remixOfId = remixOfParam && /^\d+$/.test(remixOfParam) ? Number(remixOfParam) : null;
  const stitchOfParam = searchParams.get('stitch_of');
  const stitchOfId = stitchOfParam && /^\d+$/.test(stitchOfParam) ? Number(stitchOfParam) : null;
  const ideaIdParam = searchParams.get('idea_id');
  const inspirationQuestionParam = searchParams.get('inspiration_question_id');
  const sourceIdeaId = ideaIdParam && /^\d+$/.test(ideaIdParam) ? Number(ideaIdParam) : null;
  const inspirationQuestionId =
    inspirationQuestionParam && /^\d+$/.test(inspirationQuestionParam)
      ? Number(inspirationQuestionParam)
      : null;

  const modeRemixId = paramsReady ? remixOfId : null;
  const modeStitchId = paramsReady ? stitchOfId : null;
  const pageTitle =
    modeStitchId != null
      ? t('reels.createWeaveTitle')
      : modeRemixId != null
        ? t('reels.createRemixTitle')
        : t('reels.createTitle');
  const [video, setVideo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [mood, setMood] = useState<ReelMood>('cosmic');
  const [filterStyle, setFilterStyle] = useState<ReelFilter>('none');
  const [musicTrack, setMusicTrack] = useState<number | null>(null);
  const [tracks, setTracks] = useState<ReelMusicTrack[]>([]);
  const [customAudio, setCustomAudio] = useState<File | null>(null);
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  const [musicTrim, setMusicTrim] = useState<MusicTrim>({ start: 0, end: null });
  const [soundLabel, setSoundLabel] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftError, setDraftError] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remixBusy, setRemixBusy] = useState(false);
  const [remixResult, setRemixResult] = useState<RemixMeaningResult | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [templates, setTemplates] = useState<ReelTemplate[]>([]);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [chromaEnabled, setChromaEnabled] = useState(false);
  const [backdrop, setBackdrop] = useState('');

  useEffect(() => {
    apiFetch('reel-music/')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setTracks(list);
        const preset = searchParams.get('music_track');
        if (preset) setMusicTrack(Number(preset));
      })
      .catch(() => setTracks([]));
    apiFetch('reel-templates/')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setTemplates(list);
      })
      .catch(() => setTemplates([]));
  }, [searchParams]);

  const applyTemplate = (tpl: ReelTemplate) => {
    setTemplateId(tpl.id);
    setMood((tpl.mood as ReelMood) || 'cosmic');
    setFilterStyle((tpl.filter_style as ReelFilter) || 'cosmic');
    if (tpl.music_track) setMusicTrack(tpl.music_track);
    if (tpl.default_sound_label) setSoundLabel(tpl.default_sound_label);
    if (tpl.backdrop_preset) {
      setBackdrop(tpl.backdrop_preset);
      setChromaEnabled(true);
    }
  };

  useEffect(() => {
    if (!getUser()) return;
    void (async () => {
      try {
        const res = await apiFetch('reel-drafts/');
        if (!res.ok) return;
        const data = await res.json();
        const rows = Array.isArray(data) ? data : data.results || [];
        const latest = rows[0];
        if (!latest) return;
        setDraftId(latest.id);
        setDraftRestored(true);
        setCaption(latest.caption || '');
        setMood((latest.mood as ReelMood) || 'cosmic');
        setFilterStyle((latest.filter_style as ReelFilter) || 'none');
        setTagsInput(Array.isArray(latest.tags) ? latest.tags.join(', ') : '');
        setMusicTrack(latest.music_track ?? null);
        setSoundLabel(latest.sound_label || '');
        setMusicTrim({
          start: latest.music_start_seconds ?? 0,
          end: latest.music_end_seconds ?? null,
        });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const saveDraft = useCallback(async () => {
    if (!getUser()) return;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const body = {
      caption: caption.trim(),
      mood,
      filter_style: filterStyle,
      tags,
      music_track: musicTrack,
      sound_label: soundLabel.trim(),
      music_start_seconds: musicTrim.start,
      music_end_seconds: musicTrim.end,
    };
    try {
      if (draftId) {
        const res = await apiFetchJson(`reel-drafts/${draftId}/`, { method: 'PATCH', json: body });
        if (res.ok) {
          setDraftSaved(true);
          setDraftError(false);
        } else {
          setDraftError(true);
        }
      } else if (caption.trim() || tags.length > 0 || musicTrack) {
        const res = await apiFetchJson('reel-drafts/', { method: 'POST', json: body });
        if (res.ok) {
          const created = await res.json();
          setDraftId(created.id);
          setDraftSaved(true);
          setDraftError(false);
        } else {
          setDraftError(true);
        }
      }
    } catch {
      setDraftError(true);
    }
  }, [caption, draftId, filterStyle, mood, musicTrack, musicTrim.end, musicTrim.start, soundLabel, tagsInput]);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveDraft();
    }, 1200);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [saveDraft]);

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
    const url = file ? URL.createObjectURL(file) : null;
    setPreview(url);
    if (url) {
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => {
        setDurationSeconds(Math.round(probe.duration || 0));
        URL.revokeObjectURL(probe.src);
      };
      probe.src = url;
    } else {
      setDurationSeconds(0);
    }
  };

  async function handleRemix() {
    setRemixBusy(true);
    setRemixResult(null);
    const result = await remixMeaning({
      draft_caption: caption.trim(),
      lang: (locale as 'en' | 'ar') || 'en',
    });
    setRemixBusy(false);
    if (result.error) { setError(result.error); return; }
    setRemixResult(result);
    if (result.caption) setCaption(result.caption);
  }

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
        t('reels.originalSound');
      fd.append('sound_label', label);
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      fd.append('tags', JSON.stringify(tags));
      if (durationSeconds > 0) fd.append('duration_seconds', String(durationSeconds));
      if (remixOfId != null) fd.append('remix_of', String(remixOfId));
      if (stitchOfId != null) fd.append('stitch_of', String(stitchOfId));
      if (templateId != null) fd.append('template', String(templateId));
      const effectMeta: Record<string, unknown> = {};
      if (chromaEnabled && backdrop) {
        effectMeta.backdrop = backdrop;
        effectMeta.chroma_key = true;
      }
      const tpl = templates.find((t) => t.id === templateId);
      if (tpl?.overlay_stickers?.length) effectMeta.overlays = tpl.overlay_stickers;
      if (tpl?.overlay_text) effectMeta.overlay_text = tpl.overlay_text;
      if (Object.keys(effectMeta).length) {
        fd.append('effect_meta', JSON.stringify(effectMeta));
      }
      if (sourceIdeaId != null) fd.append('source_idea', String(sourceIdeaId));
      if (inspirationQuestionId != null) fd.append('inspiration_question', String(inspirationQuestionId));
      const res = await apiFetch('reels/', { method: 'POST', body: fd });
      if (res.ok) {
        if (draftId) {
          await apiFetch(`reel-drafts/${draftId}/`, { method: 'DELETE' }).catch(() => {});
        }
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
          {pageTitle}
        </h1>
      </header>

      <form onSubmit={submit} className="reels-create__form">
        {modeRemixId != null && (
          <>
            <ReelRemixBadge
              remixOfId={modeRemixId}
              linkToReel
              labelKey="reels.remixing"
              className="reels-create__remix-banner"
            />
            <p className="reels-create__mode-hint">{t('reels.createRemixHint')}</p>
          </>
        )}
        {modeStitchId != null && (
          <>
            <ReelRemixBadge
              remixOfId={modeStitchId}
              linkToReel
              labelKey="reels.weaving"
              className="reels-create__remix-banner"
            />
            <p className="reels-create__mode-hint">{t('reels.createWeaveHint')}</p>
          </>
        )}

        <ReelCameraRecorder onRecorded={onFile} />

        {templates.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-white/90">{t('reels.pulsePacks')}</p>
            <div className="flex flex-wrap gap-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="rounded-2xl px-3 py-2 text-left text-xs"
                  style={{
                    border: templateId === tpl.id ? '2px solid #A78BFA' : '1px solid rgba(255,255,255,0.18)',
                    background: templateId === tpl.id ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    minWidth: 120,
                  }}
                >
                  <span className="block font-bold">{tpl.title}</span>
                  <span className="opacity-70">{tpl.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

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

        <ReelGreenScreenStudio
          videoUrl={preview}
          backdrop={backdrop}
          onBackdropChange={setBackdrop}
          chromaEnabled={chromaEnabled}
          onChromaChange={setChromaEnabled}
        />

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={t('reels.captionPlaceholder')}
          rows={3}
          className="reels-create__input"
        />

        <div className="flex justify-end mb-1">
          <button
            type="button"
            onClick={() => void handleRemix()}
            disabled={remixBusy}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--c-focus)' }}
          >
            {remixBusy ? t('reels.remixingMeaning') : t('reels.remixWithMeaning')}
          </button>
        </div>

        {remixResult && !remixResult.error && remixResult.why_it_matters && (
          <p className="text-xs mb-2 px-1" style={{ color: 'var(--c-text-secondary)' }}>
            💡 {remixResult.why_it_matters}
          </p>
        )}

        <input
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder={t('reels.tagsPlaceholder')}
          className="reels-create__input"
        />

        {draftRestored && (
          <p className="text-xs text-vault">{t('reels.draftRestored')}</p>
        )}
        {draftSaved && !draftError && (
          <p className="text-xs text-text-secondary">{t('reels.draftSaved')}</p>
        )}
        {draftError && (
          <p className="text-xs text-red-400">{t('reels.draftSaveFailed')}</p>
        )}

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
