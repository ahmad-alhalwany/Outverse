'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LuArrowLeft as ArrowLeft,
  LuArrowRight as ArrowRight,
  LuFlaskConical as FlaskConical,
  LuPalette as Palette,
  LuRocket as Rocket,
  LuShoppingBag as ShoppingBag,
  LuSparkles as Sparkles,
  LuStar as Star,
  LuVault as Vault,
} from 'react-icons/lu';
import { authFetch, setAuth } from '@/lib/auth';
import { apiFetch, apiUrl, mediaUrl } from '@/lib/api';
import { useLocale } from '@/components/LocaleProvider';
import { useAuthUser } from '@/lib/hooks/useAuthUser';

const WORLDS_FALLBACK = ['The Lab', 'The Bazaar', 'The Vault'];

// Backend (users/views.py WORLD_OPTIONS) returns these names in English only —
// map the known ones to translated labels; anything else falls back to the raw string.
const WORLD_LABEL_KEYS: Record<string, string> = {
  'The Lab': 'onboarding.worldLabLabel',
  'The Bazaar': 'onboarding.worldBazaarLabel',
  'The Vault': 'onboarding.worldVaultLabel',
};

// Real interest tags grouped by question category. These map cleanly to
// backend personalization in questions/interests.py — selecting any of
// them makes the Inspiration Engine bias prompts toward that category.
const INTEREST_GROUPS: { category: string; label: string; tags: string[] }[] = [
  { category: 'scifi', label: 'Science & Future', tags: ['space', 'astronomy', 'physics', 'ai', 'technology', 'future'] },
  { category: 'historical', label: 'History', tags: ['history', 'ancient', 'archaeology', 'civilizations', 'egypt', 'rome'] },
  { category: 'fantasy', label: 'Fantasy', tags: ['fantasy', 'magic', 'mythology', 'dragons', 'wizards', 'worldbuilding'] },
  { category: 'philosophical', label: 'Philosophy & Mind', tags: ['philosophy', 'ethics', 'psychology', 'meditation', 'spirituality'] },
  { category: 'mystery', label: 'Mystery', tags: ['mystery', 'detective', 'secrets', 'puzzles', 'conspiracy'] },
  { category: 'surreal', label: 'Surreal & Dreams', tags: ['surreal', 'dreams', 'absurd', 'strange'] },
  { category: 'everyday', label: 'Everyday', tags: ['nature', 'travel', 'coffee', 'food', 'photography', 'music'] },
  { category: 'emotional', label: 'Emotional & Art', tags: ['poetry', 'writing', 'art', 'painting', 'feelings', 'memory'] },
];

type Suggestion = {
  id: number;
  username: string;
  avatar: string | null;
  bio: string | null;
  followers_count: number;
  is_following: boolean;
};

const COLORS = {
  page: '#F3F0FC',
  panel: '#FFFFFF',
  panelSoft: '#DCC9FA',
  panelMuted: '#F5F1FE',
  border: '#E3D9F7',
  text: '#211B3D',
  muted: '#79709E',
  accent: '#7C3AED',
  accentDark: '#5B21B6',
  darkPanel: '#1E1740',
  peach: '#C4B5FD',
  olive: '#A855F7',
};

const GUIDE_OPTIONS = [
  { id: 'explorer', labelKey: 'onboarding.explorer', icon: Rocket },
  { id: 'creator', labelKey: 'onboarding.creator', icon: Palette },
];

const MOOD_STARS = [
  { id: 'joy', labelKey: 'onboarding.moodJoy', left: '18%', top: '28%' },
  { id: 'focus', labelKey: 'onboarding.moodFocus', left: '48%', top: '52%' },
  { id: 'creativity', labelKey: 'onboarding.moodCreativity', left: '76%', top: '70%' },
];

function initials(value: string) {
  return value.slice(0, 2).toUpperCase();
}

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [worlds, setWorlds] = useState<string[]>(WORLDS_FALLBACK);
  const [selectedWorlds, setSelectedWorlds] = useState<string[]>(WORLDS_FALLBACK);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedGuide, setSelectedGuide] = useState('explorer');
  const [selectedMood, setSelectedMood] = useState('');
  const [step, setStep] = useState(0);
  const user = useAuthUser();
  const [userChecked, setUserChecked] = useState(false);

  useEffect(() => {
    setUserChecked(true);
  }, []);

  useEffect(() => {
    if (!userChecked) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    apiFetch('users/onboarding-options/')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.worlds) && data.worlds.length) {
          setWorlds(data.worlds);
          setSelectedWorlds(data.worlds.slice(0, 3));
        }
      })
      .catch(() => {});
    apiFetch(`users/suggestions/?exclude=${user.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSuggestions(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [router, user]);

  useEffect(() => {
    if (!avatarFile) return;
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  async function skipOnboarding() {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      const form = new FormData();
      form.append('onboarding_completed', 'true');
      const res = await authFetch(apiUrl(`users/${user.id}/update/`), { method: 'PATCH', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('onboarding.saveFailed'));
      setAuth(null, { ...user, onboarding_completed: true });
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('onboarding.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      const form = new FormData();
      if (avatarFile) form.append('avatar', avatarFile);
      form.append('interests', JSON.stringify([
        ...new Set([
          `guide:${selectedGuide}`,
          ...(selectedMood ? [`mood:${selectedMood}`] : []),
          ...selectedWorlds,
          ...selectedTags,
        ]),
      ]));
      form.append('onboarding_completed', 'true');
      const res = await authFetch(apiUrl(`users/${user.id}/update/`), {
        method: 'PATCH',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('onboarding.saveFailed'));
      setAuth(null, {
        ...user,
        avatar: data.avatar,
        interests: Array.isArray(data.interests) ? data.interests : [...selectedWorlds, ...selectedTags],
        onboarding_completed: Boolean(data.onboarding_completed),
      });
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('onboarding.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleFollow(id: number) {
    const res = await apiFetch('users/follow/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ following_id: id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || t('onboarding.saveFailed'));
      return;
    }
    setSuggestions((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, is_following: Boolean(data.is_following), followers_count: Number(data.followers_count ?? item.followers_count) }
          : item,
      ),
    );
  }

  function onAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    setAvatarFile(event.target.files?.[0] ?? null);
  }

  const worldLabel = (raw: string | undefined, fallbackKey: string) =>
    raw ? (WORLD_LABEL_KEYS[raw] ? t(WORLD_LABEL_KEYS[raw]) : raw) : t(fallbackKey);

  // `value` is the raw backend string (what gets stored/sent as an interest tag);
  // `label` is only for display, so Arabic users see translated cards.
  const worldCards = [
    { value: worlds[0] ?? WORLDS_FALLBACK[0], label: worldLabel(worlds[0], 'onboarding.worldLabLabel'), icon: FlaskConical, subtitle: t('onboarding.worldLabSubtitle'), tone: COLORS.accent },
    { value: worlds[1] ?? WORLDS_FALLBACK[1], label: worldLabel(worlds[1], 'onboarding.worldBazaarLabel'), icon: ShoppingBag, subtitle: t('onboarding.worldBazaarSubtitle'), tone: '#0EA5E9' },
    { value: worlds[2] ?? WORLDS_FALLBACK[2], label: worldLabel(worlds[2], 'onboarding.worldVaultLabel'), icon: Vault, subtitle: t('onboarding.worldVaultSubtitle'), tone: COLORS.olive },
  ];

  return (
    <div className="min-h-screen" style={{ background: COLORS.page }}>
      <header className="border-b px-5 py-5 md:px-12" style={{ borderColor: '#EFE4DE' }}>
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4">
          <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: COLORS.text }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-2xl font-bold tracking-[-0.03em]" style={{ color: COLORS.text }}>{t('onboarding.header')}</h1>
          <p className="text-lg font-semibold" style={{ color: COLORS.text }}>{step + 1}/3</p>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-5 py-10 md:px-8 md:py-14">
        {step === 0 && (
        <section className="mx-auto max-w-[760px] text-center">
          <h2 className="text-4xl font-bold tracking-[-0.04em] md:text-6xl" style={{ color: COLORS.text }}>{t('onboarding.stepIdentity')}</h2>
          <div className="mt-8 rounded-[28px] border p-8 md:p-12" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
            <div className="flex items-center justify-center gap-8 md:gap-16">
              {GUIDE_OPTIONS.map(({ id, labelKey, icon: Icon }) => {
                const active = selectedGuide === id;
                return (
                  <button key={id} type="button" onClick={() => setSelectedGuide(id)} className="text-center">
                    <div
                      className="mx-auto flex h-28 w-28 items-center justify-center rounded-full md:h-36 md:w-36"
                      style={{ background: active ? COLORS.panelSoft : '#F7F5F5' }}
                    >
                      <Icon size={52} style={{ color: active ? COLORS.accent : COLORS.text }} />
                    </div>
                    <p className="mt-4 text-2xl font-semibold" style={{ color: COLORS.text }}>{t(labelKey)}</p>
                  </button>
                );
              })}
            </div>
            <h3 className="mt-10 text-3xl font-bold tracking-[-0.03em]" style={{ color: COLORS.text }}>{t('onboarding.whichRepresents')}</h3>
            <p className="mt-3 text-xl" style={{ color: COLORS.muted }}>{t('onboarding.chooseGuide')}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              {GUIDE_OPTIONS.map(({ id }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedGuide(id)}
                  className="rounded-xl px-5 py-3 text-lg font-semibold text-white"
                  style={{ background: selectedGuide === id ? COLORS.text : COLORS.accent }}
                >
                  {id === 'explorer' ? t('onboarding.imExplorer') : t('onboarding.imCreator')}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 flex items-center justify-center gap-3">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="h-3 w-3 rounded-full"
                style={{ background: index === step ? COLORS.text : '#ECE7E5' }}
              />
            ))}
          </div>
        </section>
        )}

        {step === 0 && (
        <section className="mt-16">
          <h2 className="text-center text-4xl font-bold tracking-[-0.04em] md:text-5xl" style={{ color: COLORS.text }}>{t('onboarding.moodConstellation')}</h2>
          <div className="mx-auto mt-8 max-w-[760px] rounded-[28px] border p-6 md:p-10" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
            <div className="relative h-[320px] overflow-hidden rounded-[24px]" style={{ background: COLORS.panelMuted }}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.7),_transparent_55%)]" />
              {MOOD_STARS.map((star) => (
                <button
                  key={star.id}
                  type="button"
                  onClick={() => setSelectedMood(star.id)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
                  style={{ left: star.left, top: star.top }}
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: selectedMood === star.id ? COLORS.accent : '#FFFFFF' }}>
                    <Star size={24} style={{ color: selectedMood === star.id ? '#fff' : COLORS.text }} />
                  </div>
                  <p className="mt-3 text-lg font-medium" style={{ color: COLORS.text }}>{t(star.labelKey)}</p>
                </button>
              ))}
            </div>
            <p className="mt-8 text-center text-xl" style={{ color: COLORS.muted }}>
              {t('onboarding.placeStars')}
            </p>
          </div>
        </section>
        )}

        {step === 1 && (
        <section className="mt-16">
          <h2 className="text-center text-4xl font-bold tracking-[-0.04em] md:text-5xl" style={{ color: COLORS.text }}>{t('onboarding.discoverUniverse')}</h2>
          <div className="mt-8 rounded-[28px] px-6 py-10 md:px-10" style={{ background: '#F5F3F3' }}>
            <div className="grid gap-8 md:grid-cols-3">
              {worldCards.map(({ value, label, icon: Icon, subtitle, tone }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedWorlds((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])}
                  className="flex flex-col items-center rounded-[24px] px-6 py-8 text-center transition"
                  style={{
                    background: selectedWorlds.includes(value) ? '#FFFFFF' : 'transparent',
                    boxShadow: selectedWorlds.includes(value) ? '0 12px 30px rgba(33, 27, 61, 0.10)' : 'none',
                  }}
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: '#FFFFFF' }}>
                    <Icon size={30} style={{ color: tone }} />
                  </div>
                  <p className="mt-5 text-3xl font-semibold tracking-[-0.03em]" style={{ color: COLORS.text }}>{label}</p>
                  <p className="mt-3 text-lg" style={{ color: COLORS.muted }}>{subtitle}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
        )}

        {step === 1 && (
        <section className="mt-16">
          <h2 className="text-center text-4xl font-bold tracking-[-0.04em] md:text-5xl" style={{ color: COLORS.text }}>{t('onboarding.whatSparksYou')}</h2>
          <p className="mt-3 text-center text-lg" style={{ color: COLORS.muted }}>
            {t('onboarding.sparksSubtitle')}
          </p>
          <div className="mt-8 rounded-[28px] border p-6 md:p-10" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
            <div className="grid gap-6 md:grid-cols-2">
              {INTEREST_GROUPS.map((group) => (
                <div key={group.category}>
                  <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: COLORS.muted }}>
                    {group.label}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.tags.map((tag) => {
                      const active = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setSelectedTags((current) =>
                            current.includes(tag)
                              ? current.filter((item) => item !== tag)
                              : [...current, tag],
                          )}
                          className="rounded-full px-4 py-2 text-sm font-medium transition"
                          style={{
                            background: active ? COLORS.accent : '#F7F5F5',
                            color: active ? '#fff' : COLORS.text,
                            border: `1px solid ${active ? COLORS.accent : 'transparent'}`,
                          }}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        )}

        {step === 2 && (
        <section className="mt-16 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border p-6 md:p-8" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-[-0.03em]" style={{ color: COLORS.text }}>{t('onboarding.suggestedCreators')}</h2>
                <p className="mt-2 text-lg" style={{ color: COLORS.muted }}>{t('onboarding.suggestedCreatorsSubtitle')}</p>
              </div>
              <Sparkles size={28} style={{ color: COLORS.accent }} />
            </div>
            <div className="mt-6 grid gap-4">
              {suggestions.slice(0, 4).map((creator) => (
                <div key={creator.id} className="flex items-center gap-4 rounded-[20px] border p-4" style={{ borderColor: COLORS.border, background: '#FFFDFC' }}>
                  {creator.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(creator.avatar)} alt={creator.username} className="h-14 w-14 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: COLORS.accent }}>
                      {initials(creator.username)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold" style={{ color: COLORS.text }}>@{creator.username}</p>
                    <p className="text-sm" style={{ color: COLORS.muted }}>{t('onboarding.followers', { count: creator.followers_count })}</p>
                    {creator.bio && <p className="mt-1 truncate text-sm" style={{ color: COLORS.muted }}>{creator.bio}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFollow(creator.id)}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                    style={{ background: creator.is_following ? COLORS.text : COLORS.accent }}
                  >
                    {creator.is_following ? t('onboarding.following') : t('onboarding.follow')}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border p-6 md:p-8" style={{ background: COLORS.panelSoft, borderColor: COLORS.border }}>
            <h2 className="text-3xl font-bold tracking-[-0.03em]" style={{ color: COLORS.accentDark }}>{t('onboarding.finalizeAvatar')}</h2>
            <label
              className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed px-6 py-10 text-center"
              style={{ borderColor: '#B58F82', background: COLORS.panel }}
            >
              <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
              {avatarPreview || user?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview || mediaUrl(user?.avatar || '')} alt="Avatar preview" className="h-36 w-36 rounded-full object-cover" />
              ) : (
                <div className="flex h-36 w-36 items-center justify-center rounded-full text-4xl font-bold text-white" style={{ background: COLORS.accent }}>
                  {initials(user?.username || 'OV')}
                </div>
              )}
              <p className="mt-5 text-lg font-semibold" style={{ color: COLORS.accentDark }}>
                {avatarFile ? avatarFile.name : t('onboarding.uploadAvatar')}
              </p>
              <p className="mt-2 text-sm" style={{ color: COLORS.muted }}>{t('onboarding.avatarHint')}</p>
            </label>
          </div>
        </section>
        )}

        {error && (
          <div className="mx-auto mt-8 max-w-[760px] rounded-2xl border px-4 py-3 text-sm font-medium" style={{ borderColor: '#E8B7A8', background: '#FFF1EC', color: '#A24F39' }}>
            {error}
          </div>
        )}
      </main>

      <footer className="border-t px-5 py-5 md:px-12" style={{ borderColor: '#EFE4DE' }}>
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => (step > 0 ? setStep((current) => current - 1) : router.back())}
            className="text-lg font-medium"
            style={{ color: COLORS.text }}
          >
            {t('onboarding.back')}
          </button>
          <button
            type="button"
            onClick={() => void skipOnboarding()}
            className="text-sm font-medium underline"
            style={{ color: COLORS.muted }}
          >
            {t('onboarding.skipForNow')}
          </button>
          <div className="h-4 w-56 overflow-hidden rounded-full" style={{ background: '#EFE9E6' }}>
            <div className="h-full rounded-full" style={{ width: `${((step + 1) / 3) * 100}%`, background: COLORS.text }} />
          </div>
          <button
            type="button"
            onClick={() => (step < 2 ? setStep((current) => current + 1) : void saveProfile())}
            disabled={saving}
            className="inline-flex items-center gap-3 rounded-2xl px-7 py-4 text-lg font-semibold text-white disabled:opacity-60"
            style={{ background: COLORS.text }}
          >
            {saving ? t('onboarding.saving') : step < 2 ? t('onboarding.nextStep') : t('onboarding.finish')}
            <ArrowRight size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
}