'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
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
import { authFetch, getUser, setAuth } from '@/lib/auth';
import { apiFetch, apiUrl, mediaUrl } from '@/lib/api';

const WORLDS_FALLBACK = ['The Lab', 'The Bazaar', 'The Vault'];

type Suggestion = {
  id: number;
  username: string;
  avatar: string | null;
  bio: string | null;
  followers_count: number;
  is_following: boolean;
};

const COLORS = {
  page: '#FFF8F4',
  panel: '#FFFFFF',
  panelSoft: '#FFD9CC',
  panelMuted: '#F8E7E0',
  border: '#F2D7CC',
  text: '#2E2320',
  muted: '#6F5A53',
  accent: '#9E5A43',
  accentDark: '#7F4634',
  darkPanel: '#2B201D',
  peach: '#FFB8A3',
  olive: '#7A6A2F',
};

const GUIDE_OPTIONS = [
  { id: 'explorer', label: 'The Explorer', icon: Rocket },
  { id: 'creator', label: 'The Creator', icon: Palette },
];

const MOOD_STARS = [
  { id: 'joy', label: 'Joy', left: '18%', top: '28%' },
  { id: 'focus', label: 'Focus', left: '48%', top: '52%' },
  { id: 'creativity', label: 'Creativity', left: '76%', top: '70%' },
];

function initials(value: string) {
  return value.slice(0, 2).toUpperCase();
}

export default function OnboardingPage() {
  const router = useRouter();
  const [worlds, setWorlds] = useState<string[]>(WORLDS_FALLBACK);
  const [selectedWorlds, setSelectedWorlds] = useState<string[]>(WORLDS_FALLBACK);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedGuide, setSelectedGuide] = useState('explorer');
  const user = useMemo(() => getUser(), []);

  useEffect(() => {
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

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      const form = new FormData();
      if (avatarFile) form.append('avatar', avatarFile);
      form.append('interests', JSON.stringify(selectedWorlds));
      form.append('onboarding_completed', 'true');
      const res = await authFetch(apiUrl(`users/${user.id}/update/`), {
        method: 'PATCH',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to save onboarding progress.');
      setAuth(null, {
        ...user,
        avatar: data.avatar,
        interests: Array.isArray(data.interests) ? data.interests : selectedWorlds,
        onboarding_completed: Boolean(data.onboarding_completed),
      });
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save onboarding progress.');
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
    if (!res.ok) return;
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

  const worldCards = [
    { label: worlds[0] ?? 'The Lab', icon: FlaskConical, subtitle: 'Where innovation happens', tone: COLORS.accent },
    { label: worlds[1] ?? 'The Bazaar', icon: ShoppingBag, subtitle: 'Exchange ideas and resources', tone: '#8A6A5B' },
    { label: worlds[2] ?? 'The Vault', icon: Vault, subtitle: 'Store your achievements', tone: COLORS.olive },
  ];

  return (
    <div className="min-h-screen" style={{ background: COLORS.page }}>
      <header className="border-b px-5 py-5 md:px-12" style={{ borderColor: '#EFE4DE' }}>
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4">
          <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: COLORS.text }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-2xl font-bold tracking-[-0.03em]" style={{ color: COLORS.text }}>Space Journey</h1>
          <p className="text-lg font-semibold" style={{ color: COLORS.text }}>1/3</p>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-5 py-10 md:px-8 md:py-14">
        <section className="mx-auto max-w-[760px] text-center">
          <h2 className="text-4xl font-bold tracking-[-0.04em] md:text-6xl" style={{ color: COLORS.text }}>Choose Your Space Identity</h2>
          <div className="mt-8 rounded-[28px] border p-8 md:p-12" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
            <div className="flex items-center justify-center gap-8 md:gap-16">
              {GUIDE_OPTIONS.map(({ id, label, icon: Icon }) => {
                const active = selectedGuide === id;
                return (
                  <button key={id} type="button" onClick={() => setSelectedGuide(id)} className="text-center">
                    <div
                      className="mx-auto flex h-28 w-28 items-center justify-center rounded-full md:h-36 md:w-36"
                      style={{ background: active ? COLORS.panelSoft : '#F7F5F5' }}
                    >
                      <Icon size={52} style={{ color: active ? COLORS.accent : COLORS.text }} />
                    </div>
                    <p className="mt-4 text-2xl font-semibold" style={{ color: COLORS.text }}>{label}</p>
                  </button>
                );
              })}
            </div>
            <h3 className="mt-10 text-3xl font-bold tracking-[-0.03em]" style={{ color: COLORS.text }}>Which represents you better?</h3>
            <p className="mt-3 text-xl" style={{ color: COLORS.muted }}>Choose your spirit guide for this journey</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              {GUIDE_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedGuide(id)}
                  className="rounded-xl px-5 py-3 text-lg font-semibold text-white"
                  style={{ background: selectedGuide === id ? COLORS.text : COLORS.accent }}
                >
                  {id === 'explorer' ? "I'm an Explorer" : "I'm a Creator"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 flex items-center justify-center gap-3">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className="h-3 w-3 rounded-full"
                style={{ background: index === 0 ? COLORS.text : '#ECE7E5' }}
              />
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-center text-4xl font-bold tracking-[-0.04em] md:text-5xl" style={{ color: COLORS.text }}>Discover Your Universe</h2>
          <div className="mt-8 rounded-[28px] px-6 py-10 md:px-10" style={{ background: '#F5F3F3' }}>
            <div className="grid gap-8 md:grid-cols-3">
              {worldCards.map(({ label, icon: Icon, subtitle, tone }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSelectedWorlds((current) => current.includes(label) ? current.filter((item) => item !== label) : [...current, label])}
                  className="flex flex-col items-center rounded-[24px] px-6 py-8 text-center transition"
                  style={{
                    background: selectedWorlds.includes(label) ? '#FFFFFF' : 'transparent',
                    boxShadow: selectedWorlds.includes(label) ? '0 12px 30px rgba(92, 53, 39, 0.08)' : 'none',
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

        <section className="mt-16">
          <h2 className="text-center text-4xl font-bold tracking-[-0.04em] md:text-5xl" style={{ color: COLORS.text }}>Create Your Mood Constellation</h2>
          <div className="mx-auto mt-8 max-w-[760px] rounded-[28px] border p-6 md:p-10" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
            <div className="relative h-[320px] overflow-hidden rounded-[24px]" style={{ background: COLORS.panelMuted }}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.7),_transparent_55%)]" />
              {MOOD_STARS.map((star) => (
                <div key={star.id} className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: star.left, top: star.top }}>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: '#FFFFFF' }}>
                    <Star size={24} style={{ color: COLORS.text }} />
                  </div>
                  <p className="mt-3 text-lg font-medium" style={{ color: COLORS.text }}>{star.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-xl" style={{ color: COLORS.muted }}>
              Place three stars to represent your current emotional state
            </p>
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border p-6 md:p-8" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-[-0.03em]" style={{ color: COLORS.text }}>Suggested creators</h2>
                <p className="mt-2 text-lg" style={{ color: COLORS.muted }}>Start your feed with a few voices from across the Outverse.</p>
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
                    <p className="text-sm" style={{ color: COLORS.muted }}>{creator.followers_count} followers</p>
                    {creator.bio && <p className="mt-1 truncate text-sm" style={{ color: COLORS.muted }}>{creator.bio}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFollow(creator.id)}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                    style={{ background: creator.is_following ? COLORS.text : COLORS.accent }}
                  >
                    {creator.is_following ? 'Following' : 'Follow'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border p-6 md:p-8" style={{ background: COLORS.panelSoft, borderColor: COLORS.border }}>
            <h2 className="text-3xl font-bold tracking-[-0.03em]" style={{ color: COLORS.accentDark }}>Finalize your avatar</h2>
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
                {avatarFile ? avatarFile.name : 'Upload your profile image'}
              </p>
              <p className="mt-2 text-sm" style={{ color: COLORS.muted }}>PNG or JPG recommended</p>
            </label>
          </div>
        </section>

        {error && (
          <div className="mx-auto mt-8 max-w-[760px] rounded-2xl border px-4 py-3 text-sm font-medium" style={{ borderColor: '#E8B7A8', background: '#FFF1EC', color: '#A24F39' }}>
            {error}
          </div>
        )}
      </main>

      <footer className="border-t px-5 py-5 md:px-12" style={{ borderColor: '#EFE4DE' }}>
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4">
          <Link href="/register" className="text-lg font-medium" style={{ color: COLORS.text }}>
            Back
          </Link>
          <div className="h-4 w-56 overflow-hidden rounded-full" style={{ background: '#EFE9E6' }}>
            <div className="h-full rounded-full" style={{ width: '33.333%', background: COLORS.text }} />
          </div>
          <button
            type="button"
            onClick={saveProfile}
            disabled={saving}
            className="inline-flex items-center gap-3 rounded-2xl px-7 py-4 text-lg font-semibold text-white disabled:opacity-60"
            style={{ background: COLORS.text }}
          >
            {saving ? 'Saving...' : 'Next Step'}
            <ArrowRight size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
}