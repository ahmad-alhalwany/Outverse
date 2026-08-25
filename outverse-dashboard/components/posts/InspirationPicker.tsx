'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  SparklesIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import {
  fetchNextQuestion,
  generateQuestion,
  skipQuestion,
  rememberShown,
  suggestQuestion,
  fetchAnsweredBy,
  type InspirationQuestion,
  type AnsweredByUser,
} from '@/lib/questionsApi';
import { UserGroupIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { shareQuestionAsImage } from '@/lib/promptCardImage';
import { useDialogA11y } from '@/lib/hooks/useDialogA11y';

const PALETTES = {
  light: {
    overlay: 'rgba(33,27,61,0.45)',
    card: '#FFFFFF',
    text: '#211B3D',
    muted: '#79709E',
    accent: '#7C3AED',
    accentSoft: '#EDE4FB',
    chipBg: '#E9E1FA',
    chipText: '#7C3AED',
    spark: 'linear-gradient(135deg,#C4B5FD 0%,#7C3AED 100%)',
  },
  dark: {
    overlay: 'rgba(10,8,24,0.65)',
    card: '#1E1740',
    text: '#F5F3FF',
    muted: '#B0A6D9',
    accent: '#C4B5FD',
    accentSoft: '#3A2A6B',
    chipBg: 'rgba(255,255,255,0.06)',
    chipText: '#C4B5FD',
    spark: 'linear-gradient(135deg,#6A00FF 0%,#A855F7 100%)',
  },
} as const;

const CATEGORY_KEYS: Record<string, string> = {
  historical: 'inspiration.categoryHistorical',
  fantasy: 'inspiration.categoryFantasy',
  scifi: 'inspiration.categoryScifi',
  philosophical: 'inspiration.categoryPhilosophical',
  mystery: 'inspiration.categoryMystery',
  surreal: 'inspiration.categorySurreal',
  everyday: 'inspiration.categoryEveryday',
  emotional: 'inspiration.categoryEmotional',
};

const CATEGORY_ORDER = [
  'all',
  'historical',
  'fantasy',
  'scifi',
  'philosophical',
  'mystery',
  'surreal',
  'everyday',
  'emotional',
];

type InspirationPickerProps = {
  open: boolean;
  onClose: () => void;
  onUse: (question: InspirationQuestion) => void;
};

export default function InspirationPicker({ open, onClose, onUse }: InspirationPickerProps) {
  const { theme } = useTheme();
  const { t, locale, dir } = useLocale();
  const C = PALETTES[theme];

  const [question, setQuestion] = useState<InspirationQuestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestText, setSuggestText] = useState('');
  const [suggestStatus, setSuggestStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answeredBy, setAnsweredBy] = useState<AnsweredByUser[] | null>(null);
  const [loadingAnsweredBy, setLoadingAnsweredBy] = useState(false);
  const [answeredByError, setAnsweredByError] = useState(false);
  const [shareImageError, setShareImageError] = useState(false);
  const dialogRef = useDialogA11y<HTMLDivElement>(open, onClose);

  const load = useCallback(async (cat?: string) => {
    if (question?.id) void skipQuestion(question.id);
    setLoading(true);
    setError('');
    try {
      const q = await fetchNextQuestion({
        lang: locale,
        category: cat ?? category,
        personalize: !cat || cat === 'all',
      });
      if (!q) {
        setError(t('inspiration.empty'));
        setQuestion(null);
      } else {
        setQuestion(q);
        rememberShown(q);
      }
    } catch {
      setError(t('inspiration.error'));
    } finally {
      setLoading(false);
    }
  }, [locale, category, t, question?.id]);

  const generate = useCallback(async () => {
    if (question?.id) void skipQuestion(question.id);
    setLoading(true);
    setError('');
    try {
      const q = await generateQuestion({ lang: locale, category });
      if (!q) {
        setError(t('inspiration.empty'));
        setQuestion(null);
      } else {
        setQuestion(q);
        rememberShown(q);
      }
    } catch {
      setError(t('inspiration.error'));
    } finally {
      setLoading(false);
    }
  }, [locale, category, t, question?.id]);

  useEffect(() => {
    if (open && !question) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function selectCategory(cat: string) {
    setCategory(cat);
    setQuestion(null);
    load(cat);
  }

  function handleUse() {
    if (!question) return;
    onUse(question);
    onClose();
  }

  const categoryLabel = (cat: string) => {
    if (cat === 'all') return t('inspiration.categoryAll');
    const key = CATEGORY_KEYS[cat];
    return key ? t(key as never) : cat;
  };

  async function submitSuggestion() {
    const text = suggestText.trim();
    if (text.length < 8) {
      setSuggestStatus({ ok: false, message: t('inspiration.suggestTooShort') });
      return;
    }
    setSubmitting(true);
    setSuggestStatus(null);
    try {
      const result = await suggestQuestion({
        text,
        category: category !== 'all' ? category : 'surreal',
        lang: locale,
      });
      if (result.ok) {
        setSuggestStatus({ ok: true, message: t('inspiration.suggestThanks') });
        setSuggestText('');
      } else {
        setSuggestStatus({
          ok: false,
          message: result.error || t('inspiration.suggestError'),
        });
      }
    } catch {
      setSuggestStatus({ ok: false, message: t('inspiration.suggestError') });
    } finally {
      setSubmitting(false);
    }
  }

  async function seeWhoAnswered() {
    if (!question) return;
    setLoadingAnsweredBy(true);
    setAnsweredBy(null);
    setAnsweredByError(false);
    try {
      const users = await fetchAnsweredBy(question.id);
      setAnsweredBy(users);
    } catch {
      setAnsweredByError(true);
    } finally {
      setLoadingAnsweredBy(false);
    }
  }

  async function shareAsImage() {
    if (!question) return;
    setShareImageError(false);
    try {
      await shareQuestionAsImage(question, { theme, locale });
    } catch {
      setShareImageError(true);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          dir={dir}
          onClick={onClose}
        >
          <div className="absolute inset-0" style={{ background: C.overlay }} aria-hidden />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('inspiration.title')}
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl"
            style={{ background: C.card, color: C.text }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={t('inspiration.close')}
              className="absolute top-4 ltr:right-4 rtl:left-4 rounded-full p-1.5 hover:opacity-80"
              style={{ color: C.muted }}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>

            <header className="mb-4 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl text-white"
                style={{ background: C.spark }}
              >
                <SparklesIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: C.text }}>
                  {t('inspiration.title')}
                </h2>
                <p className="text-xs" style={{ color: C.muted }}>
                  {t('inspiration.subtitle')}
                </p>
              </div>
            </header>

            <div
              className="mb-4 flex flex-wrap gap-1.5"
              role="tablist"
              aria-label={t('inspiration.categoryAll')}
            >
              {CATEGORY_ORDER.map((cat) => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectCategory(cat)}
                    className="rounded-full px-3 py-1.5 text-xs font-medium transition"
                    style={{
                      background: active ? C.accent : C.chipBg,
                      color: active ? '#fff' : C.chipText,
                      border: `1px solid ${active ? C.accent : 'transparent'}`,
                    }}
                  >
                    {categoryLabel(cat)}
                  </button>
                );
              })}
            </div>

            <div
              className="min-h-[160px] rounded-2xl p-5 md:p-6 flex items-center justify-center text-center"
              style={{ background: C.accentSoft }}
            >
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-full border-2 border-transparent animate-spin"
                    style={{ borderTopColor: C.accent, borderRightColor: C.accent }}
                  />
                  <span className="text-sm" style={{ color: C.muted }}>
                    {t('inspiration.loading')}
                  </span>
                </div>
              ) : error ? (
                <p className="text-sm" style={{ color: C.muted }}>
                  {error}
                </p>
              ) : question ? (
                <p className="text-lg md:text-xl font-semibold leading-relaxed" style={{ color: C.text }}>
                  {question.text}
                </p>
              ) : (
                <p className="text-sm" style={{ color: C.muted }}>
                  —
                </p>
              )}
            </div>

            {question && !loading && (
              <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium"
                  style={{ background: C.chipBg, color: C.chipText }}
                >
                  {categoryLabel(question.category)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={seeWhoAnswered}
                    disabled={loadingAnsweredBy}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition hover:opacity-80 disabled:opacity-50"
                    style={{ color: C.muted }}
                    title={t('inspiration.answeredByHint')}
                  >
                    <UserGroupIcon className="h-3.5 w-3.5" />
                    {loadingAnsweredBy
                      ? t('inspiration.answeredByLoading')
                      : t('inspiration.answeredBy')}
                  </button>
                  <button
                    type="button"
                    onClick={shareAsImage}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition hover:opacity-80"
                    style={{ color: C.muted }}
                    title={t('inspiration.shareImageHint')}
                  >
                    <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                    {t('inspiration.shareImage')}
                  </button>
                </div>
              </div>
            )}

            {shareImageError && (
              <p className="mt-2 text-xs" style={{ color: '#B23A3A' }}>
                {t('inspiration.shareImageError')}
              </p>
            )}

            {answeredByError && (
              <p className="mt-2 text-xs" style={{ color: '#B23A3A' }}>
                {t('inspiration.answeredByError')}
              </p>
            )}

            {answeredBy !== null && (
              <div
                className="mt-3 rounded-2xl p-3"
                style={{ background: C.chipBg }}
              >
                <p className="text-xs font-semibold" style={{ color: C.text }}>
                  {answeredBy.length > 0
                    ? `${answeredBy.length} ${t('inspiration.answeredByCount')}`
                    : t('inspiration.answeredByEmpty')}
                </p>
                {answeredBy.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {answeredBy.slice(0, 12).map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-1.5 rounded-full px-2 py-1"
                        style={{ background: C.card }}
                        title={u.username}
                      >
                        {u.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.avatar}
                            alt={u.username}
                            className="h-5 w-5 rounded-full object-cover"
                          />
                        ) : (
                          <span
                            className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ background: C.accent }}
                          >
                            {(u.name || u.username).slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="text-[11px] font-medium" style={{ color: C.text }}>
                          {u.name || u.username}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => load()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition hover:opacity-80 disabled:opacity-50"
                style={{
                  background: 'transparent',
                  color: C.accent,
                  border: `1px solid ${C.accent}`,
                }}
              >
                <ArrowPathIcon className="h-4 w-4" />
                {t('inspiration.another')}
              </button>
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition hover:opacity-80 disabled:opacity-50"
                style={{
                  background: 'transparent',
                  color: C.muted,
                  border: `1px solid ${C.muted}`,
                }}
                title={t('inspiration.generateHint')}
              >
                <CpuChipIcon className="h-4 w-4" />
                {t('inspiration.generate')}
              </button>
              <button
                type="button"
                onClick={handleUse}
                disabled={loading || !question}
                className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: C.accent }}
              >
                <CheckIcon className="h-4 w-4" />
                {t('inspiration.useThis')}
              </button>
            </div>

            <div className="mt-3 border-t pt-3" style={{ borderColor: C.chipBg }}>
              <button
                type="button"
                onClick={() => setSuggestOpen((v) => !v)}
                className="text-xs font-medium transition hover:opacity-80"
                style={{ color: C.muted }}
              >
                {t('inspiration.suggestToggle')}
              </button>
              {suggestOpen && (
                <div className="mt-3">
                  <textarea
                    value={suggestText}
                    onChange={(e) => setSuggestText(e.target.value)}
                    placeholder={t('inspiration.suggestPlaceholder')}
                    rows={3}
                    className="w-full resize-none rounded-xl p-3 text-sm outline-none"
                    style={{
                      background: C.chipBg,
                      color: C.text,
                      border: `1px solid ${C.chipBg}`,
                    }}
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    {suggestStatus ? (
                      <span
                        className="text-xs"
                        style={{ color: suggestStatus.ok ? C.accent : '#B23A3A' }}
                      >
                        {suggestStatus.message}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: C.muted }}>
                        {t('inspiration.suggestHint')}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={submitSuggestion}
                      disabled={submitting}
                      className="rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: C.accent }}
                    >
                      {submitting ? t('inspiration.suggestSubmitting') : t('inspiration.suggestSubmit')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
