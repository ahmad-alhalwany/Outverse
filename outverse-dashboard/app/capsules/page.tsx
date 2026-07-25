'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  LockClosedIcon,
  LockOpenIcon,
  PaperAirplaneIcon,
  MicrophoneIcon,
  XMarkIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import {
  createCapsule,
  fetchMyCapsules,
  openCapsule,
  capsuleVoiceUrl,
  type TimeCapsule,
} from '@/lib/capsulesApi';
import { polishVaultTone } from '@/lib/aiCoachApi';

type Duration = 'week' | 'month' | 'halfYear' | 'year';

const DURATIONS: { id: Duration; days: number }[] = [
  { id: 'week', days: 7 },
  { id: 'month', days: 30 },
  { id: 'halfYear', days: 182 },
  { id: 'year', days: 365 },
];

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatRemaining(openAt: string): string {
  const target = new Date(openAt).getTime();
  const diff = target - Date.now();
  if (diff <= 0) return '';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  return `${days}d ${hours}h`;
}

export default function CapsulesPage() {
  const { theme } = useTheme();
  const { t, locale, dir } = useLocale();
  const user = useAuthUser();
  const searchParams = useSearchParams();
  const isAuthed = !!user;

  const [capsules, setCapsules] = useState<TimeCapsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');

  useEffect(() => {
    const ideaId = searchParams.get('idea_id');
    if (ideaId) {
      setText((prev) => prev || `Sealed note for Bazaar idea #${ideaId} — future me, keep building.`);
    }
  }, [searchParams]);

  const [duration, setDuration] = useState<Duration>('month');
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [sealing, setSealing] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const [openingId, setOpeningId] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<TimeCapsule | null>(null);
  const [polishing, setPolishing] = useState(false);
  const [polishNote, setPolishNote] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const palette = useMemo(() => (theme === 'dark' ? DARK : LIGHT), [theme]);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await fetchMyCapsules();
    setCapsules(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthed) load();
    else setLoading(false);
  }, [isAuthed, load]);

  async function handlePolish() {
    if (!text.trim()) return;
    setPolishing(true);
    setPolishNote('');
    const result = await polishVaultTone({ text: text.trim(), kind: 'capsule', lang: locale as 'en' | 'ar' });
    setPolishing(false);
    if (result.error) { setFormError(result.error); return; }
    setText(result.polished);
    setPolishNote(result.note);
  }

  async function handleSeal() {
    setFormError('');
    setSuccess('');
    if (text.trim().length < 4) {
      setFormError(t('capsules.tooShort'));
      return;
    }
    setSealing(true);
    const openAt = addDays(new Date(), DURATIONS.find((d) => d.id === duration)!.days);
    const created = await createCapsule({ text: text.trim(), openAt, voiceFile });
    setSealing(false);
    if (!created) {
      setFormError(t('capsules.error'));
      return;
    }
    setSuccess(t('capsules.sealed'));
    setText('');
    setVoiceFile(null);
    setCapsules((prev) => [created, ...prev]);
  }

  async function handleOpen(capsule: TimeCapsule) {
    setOpeningId(capsule.id);
    const opened = await openCapsule(capsule.id);
    setOpeningId(null);
    if (opened) {
      setRevealed(opened);
      setCapsules((prev) => prev.map((c) => (c.id === opened.id ? opened : c)));
    }
  }

  return (
    <div dir={dir} className="mx-auto max-w-3xl px-4 py-8 md:py-12" style={{ background: palette.page, minHeight: '100vh' }}>
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ color: palette.text }}>
          {t('capsules.title')}
        </h1>
        <p className="mt-2 text-sm md:text-base" style={{ color: palette.muted }}>
          {t('capsules.subtitle')}
        </p>
      </header>

      {!isAuthed ? (
        <div
          className="rounded-2xl border p-6 text-center text-sm"
          style={{ borderColor: palette.border, background: palette.card, color: palette.muted }}
        >
          {t('capsules.needsAuth')}
        </div>
      ) : (
        <>
          <section
            className="rounded-3xl border p-6 md:p-8 mb-10"
            style={{ borderColor: palette.border, background: palette.card }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl text-white"
                style={{ background: palette.accent }}
              >
                <SparklesIcon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold" style={{ color: palette.text }}>
                {t('capsules.createTitle')}
              </h2>
            </div>

            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: palette.muted }}>
              {t('capsules.bodyLabel')}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder={t('capsules.bodyPlaceholder')}
              className="w-full resize-none rounded-2xl p-4 text-sm outline-none"
              style={{
                background: palette.inputBg,
                color: palette.text,
                border: `1px solid ${palette.border}`,
              }}
            />

            <div className="flex items-center justify-between mt-1 mb-4">
              {polishNote ? (
                <p className="text-xs" style={{ color: palette.muted }}>✨ {polishNote}</p>
              ) : <span />}
              <button
                type="button"
                onClick={() => void handlePolish()}
                disabled={polishing || text.trim().length < 4}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-all"
                style={{ background: palette.accent }}
              >
                {polishing ? '✨ Polishing…' : '✨ Polish tone'}
              </button>
            </div>

            <label className="block text-xs font-semibold uppercase tracking-wide mt-5 mb-2" style={{ color: palette.muted }}>
              {t('capsules.whenLabel')}
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => {
                const active = duration === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDuration(d.id)}
                    className="rounded-full px-4 py-2 text-sm font-medium transition"
                    style={{
                      background: active ? palette.accent : palette.chipBg,
                      color: active ? '#fff' : palette.text,
                      border: `1px solid ${active ? palette.accent : 'transparent'}`,
                    }}
                  >
                    {t(`capsules.${d.id}` as never)}
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: palette.muted }}>
                {t('capsules.voiceLabel')}
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                  style={{
                    background: palette.chipBg,
                    color: palette.text,
                    border: `1px solid ${palette.border}`,
                  }}
                >
                  <MicrophoneIcon className="h-4 w-4" />
                  {voiceFile ? voiceFile.name : 'Upload .mp3 / .m4a'}
                </button>
                {voiceFile && (
                  <button
                    type="button"
                    onClick={() => setVoiceFile(null)}
                    className="rounded-full p-1.5"
                    style={{ color: palette.muted }}
                    aria-label="remove voice"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
                <input
                  type="file"
                  accept="audio/*"
                  ref={fileInput}
                  className="hidden"
                  onChange={(e) => setVoiceFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            {formError && (
              <p className="mt-4 text-sm" style={{ color: palette.danger }}>
                {formError}
              </p>
            )}
            {success && (
              <p className="mt-4 text-sm" style={{ color: palette.accent }}>
                {success}
              </p>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSeal}
                disabled={sealing}
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: palette.accent }}
              >
                <PaperAirplaneIcon className="h-4 w-4" />
                {sealing ? t('capsules.sealing') : t('capsules.seal')}
              </button>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4" style={{ color: palette.text }}>
              {loading ? '...' : `${capsules.length} ${locale === 'ar' ? 'كبسولة' : 'capsules'}`}
            </h2>
            {!loading && capsules.length === 0 ? (
              <div
                className="rounded-2xl border p-8 text-center text-sm"
                style={{ borderColor: palette.border, background: palette.card, color: palette.muted }}
              >
                {t('capsules.empty')}
              </div>
            ) : (
              <div className="grid gap-4">
                {capsules.map((c) => (
                  <CapsuleCard
                    key={c.id}
                    capsule={c}
                    palette={palette}
                    opening={openingId === c.id}
                    onOpen={() => handleOpen(c)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {revealed && (
        <RevealModal
          capsule={revealed}
          palette={palette}
          onClose={() => setRevealed(null)}
          t={t}
        />
      )}
    </div>
  );
}

type Palette = typeof LIGHT;

function CapsuleCard({
  capsule,
  palette,
  opening,
  onOpen,
  t,
}: {
  capsule: TimeCapsule;
  palette: Palette;
  opening: boolean;
  onOpen: () => void;
  t: (key: string) => string;
}) {
  const remaining = formatRemaining(capsule.open_at);
  const status = !capsule.is_unlocked
    ? t('capsules.locked')
    : capsule.is_opened
      ? t('capsules.opened')
      : t('capsules.ready');

  const Icon = capsule.is_unlocked ? LockOpenIcon : LockClosedIcon;

  return (
    <div
      className="rounded-2xl border p-5 md:p-6"
      style={{ borderColor: palette.border, background: palette.card }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: palette.chipBg, color: palette.accent }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: palette.text }}>
              {status}
            </p>
            <p className="text-xs" style={{ color: palette.muted }}>
              {t('capsules.sealedOn')} {new Date(capsule.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        {remaining && (
          <span
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: palette.chipBg, color: palette.muted }}
          >
            {t('capsules.opensIn')} {remaining}
          </span>
        )}
      </div>

      <div className="mt-4">
        {capsule.is_unlocked ? (
          <p className="text-sm" style={{ color: palette.muted }}>
            {capsule.text.slice(0, 120) || t('capsules.lockedHint')}
            {capsule.text.length > 120 ? '...' : ''}
          </p>
        ) : (
          <p className="text-sm italic" style={{ color: palette.muted }}>
            {t('capsules.lockedHint')}
          </p>
        )}
      </div>

      {capsule.is_unlocked && !capsule.is_opened && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onOpen}
            disabled={opening}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: palette.accent }}
          >
            <LockOpenIcon className="h-4 w-4" />
            {opening ? t('capsules.opening') : t('capsules.open')}
          </button>
        </div>
      )}
    </div>
  );
}

function RevealModal({
  capsule,
  palette,
  onClose,
  t,
}: {
  capsule: TimeCapsule;
  palette: Palette;
  onClose: () => void;
  t: (key: string) => string;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0" style={{ background: palette.overlay }} />
      <div
        className="relative w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl"
        style={{ background: palette.card, color: palette.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1.5"
          style={{ color: palette.muted }}
          aria-label="close"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
        <p className="text-xs uppercase tracking-wide" style={{ color: palette.muted }}>
          {t('capsules.openedOn')} {new Date(capsule.opened_at || capsule.open_at).toLocaleDateString()}
        </p>
        <p className="mt-4 text-lg md:text-xl font-semibold leading-relaxed" style={{ color: palette.text }}>
          {capsule.text}
        </p>
        {capsule.voice_url && (
          <audio
            controls
            src={capsuleVoiceUrl(capsule.voice_url)}
            className="mt-5 w-full"
          />
        )}
      </div>
    </div>
  );
}

const LIGHT = {
  page: '#F3F0FC',
  card: '#FFFFFF',
  inputBg: '#F5F1FE',
  text: '#211B3D',
  muted: '#79709E',
  accent: '#7C3AED',
  border: '#E3D9F7',
  chipBg: '#E9E1FA',
  danger: '#B23A3A',
  overlay: 'rgba(33,27,61,0.45)',
};

const DARK = {
  page: '#14102A',
  card: '#1E1740',
  inputBg: '#1E1740',
  text: '#F5F3FF',
  muted: '#B0A6D9',
  accent: '#C4B5FD',
  border: 'rgba(255,255,255,0.08)',
  chipBg: 'rgba(255,255,255,0.06)',
  danger: '#E57373',
  overlay: 'rgba(10,8,24,0.65)',
};
