'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { apiUrl, mediaUrl } from '@/lib/api';
import { authFetch, getCurrentUserId, getUser, setAuth, getToken } from '@/lib/auth';

type ProfileShape = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  bio: string | null;
  location?: string;
  avatar: string | null;
};

type Props = {
  profile: ProfileShape;
  colors: Record<string, string>;
  onClose: () => void;
  onSaved: (updated: ProfileShape) => void;
};

export default function EditProfileModal({ profile, colors: C, onClose, onSaved }: Props) {
  const [firstName, setFirstName] = useState(profile.first_name || '');
  const [lastName, setLastName] = useState(profile.last_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [location, setLocation] = useState(profile.location || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(profile.avatar || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!avatarFile) return;
    const url = URL.createObjectURL(avatarFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('first_name', firstName.trim());
      fd.append('last_name', lastName.trim());
      fd.append('bio', bio.trim());
      fd.append('location', location.trim());
      if (avatarFile) fd.append('avatar', avatarFile);

      const res = await authFetch(apiUrl(`users/${profile.id}/update/`), {
        method: 'PATCH',
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || 'Save failed');
      }
      const data = await res.json();
      const updated: ProfileShape = {
        id: data.id,
        username: data.username,
        first_name: data.first_name,
        last_name: data.last_name,
        bio: data.bio,
        location: data.location,
        avatar: data.avatar,
      };
      const token = getToken();
      const u = getUser();
      if (token && u && u.id === profile.id) {
        setAuth(token, {
          ...u,
          first_name: data.first_name,
          last_name: data.last_name,
          avatar: data.avatar,
        });
      }
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  const avatarDisplay = preview ? (preview.startsWith('blob:') ? preview : mediaUrl(preview)) : '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.form
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSave}
        className="w-full max-w-md rounded-2xl p-6 relative"
        style={{ background: C.cream, border: `1px solid ${C.line}`, color: C.text }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 left-3 w-9 h-9 rounded-full text-xl"
          style={{ background: C.card, color: C.text }}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-lg font-bold mb-4 pr-8">Edit profile</h2>

        <div className="flex items-center gap-4 mb-4">
          {avatarDisplay ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarDisplay} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <span
              className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-white"
              style={{ background: C.brown }}
            >
              {profile.username.slice(0, 2).toUpperCase()}
            </span>
          )}
          <label className="text-sm font-medium cursor-pointer" style={{ color: C.brown }}>
            Change photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs" style={{ color: C.text2 }}>First name</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full mt-1 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
            />
          </div>
          <div>
            <label className="text-xs" style={{ color: C.text2 }}>Last name</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full mt-1 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="text-xs" style={{ color: C.text2 }}>Location</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Damascus, Syria"
            className="w-full mt-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
          />
        </div>

        <div className="mb-3">
          <label className="text-xs" style={{ color: C.text2 }}>Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full mt-1 rounded-xl px-3 py-2 text-sm outline-none resize-none"
            style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
          />
        </div>

        {error && <p className="text-sm mb-2" style={{ color: '#c0392b' }}>{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-60"
          style={{ background: C.brownDk }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </motion.form>
    </motion.div>
  );
}
