'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { IDEA_KIND_ICONS, type ShopItem } from '@/lib/shopTypes';

const PALETTES = {
  light: {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    overlay: 'rgba(33,27,61,0.45)',
    shadow: '0 8px 24px rgba(33,27,61,0.3)',
  },
  dark: {
    cream: '#14102A',
    card: '#1E1740',
    card2: '#251B4D',
    white: '#2A2154',
    brown: '#C4B5FD',
    brownDk: '#A78BFA',
    text: '#F5F3FF',
    text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)',
    overlay: 'rgba(10,8,24,0.65)',
    shadow: '0 8px 24px rgba(167,139,250,0.2)',
  },
} as const;

const TYPE_OPTIONS = ['digital', 'physical', 'idea'] as const;
const CATEGORY_OPTIONS = ['art', 'template', 'story', 'design', 'music', 'effect', 'other'] as const;
const IDEA_KIND_OPTIONS = [
  '', 'cursed_prompt', 'alternate_you', 'blind_drop', 'constellation_pack', 'bottle', 'reverse_commission',
] as const;

function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ProductFormModal({
  item,
  onClose,
  onSaved,
}: {
  item?: ShopItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { theme } = useTheme();
  const C = PALETTES[theme];
  const { t } = useLocale();
  const isEdit = !!item;
  const user = getUser();
  const canRunFullShop = !!(user?.is_staff || user?.is_shop_seller);

  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [type, setType] = useState(item?.type ?? (canRunFullShop ? 'digital' : 'idea'));
  const [category, setCategory] = useState(item?.category ?? 'art');
  const [stock, setStock] = useState(item?.stock != null ? String(item.stock) : '');
  const [downloadUrl, setDownloadUrl] = useState(item?.download_url ?? '');
  const [ideaKind, setIdeaKind] = useState(item?.idea_kind ?? '');
  const [unlockAt, setUnlockAt] = useState(toDatetimeLocal(item?.unlock_at));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(item?.cover || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function onImageChange(file: File | null) {
    if (imagePreview && imageFile) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : '');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !description.trim() || !price) {
      setError('Name, description, and price are required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('description', description.trim());
      form.append('price', price);
      form.append('type', type);
      form.append('category', category);
      form.append('stock', stock.trim());
      form.append('download_url', downloadUrl.trim());
      form.append('idea_kind', type === 'idea' ? ideaKind : '');
      // DateTimeField rejects an empty string outright — only send it when set,
      // and only when it's actually a "bottle" idea; omitting the key leaves it unchanged.
      if (type === 'idea' && ideaKind === 'bottle' && unlockAt) {
        form.append('unlock_at', new Date(unlockAt).toISOString());
      }
      if (imageFile) form.append('image', imageFile);
      const url = isEdit ? `shop/items/${item!.id}/` : 'shop/items/';
      const res = await apiFetch(url, { method: isEdit ? 'PATCH' : 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const fieldErr =
          typeof data.detail === 'string'
            ? data.detail
            : typeof data.image?.[0] === 'string'
              ? data.image[0]
              : null;
        throw new Error(fieldErr || t('creatorDashboard.saveFailed'));
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('creatorDashboard.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const field = { background: C.white, border: `1px solid ${C.line}`, color: C.text } as const;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: C.overlay, backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <motion.form
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto"
        style={{ background: C.cream, boxShadow: C.shadow, border: `1px solid ${C.line}` }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full text-xl flex items-center justify-center"
          style={{ background: C.card, color: C.text }}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-lg font-semibold mb-4" style={{ color: C.text }}>
          {isEdit ? t('creatorDashboard.editProduct') : t('creatorDashboard.addProduct')}
        </h2>

        <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('creatorDashboard.fieldName')}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none" style={field} />

        <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('creatorDashboard.fieldDescription')}</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none resize-none" style={field} />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('creatorDashboard.fieldPrice')}</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none"
              style={field}
            />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('creatorDashboard.fieldStock')}</label>
            <input
              value={stock}
              onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder={t('creatorDashboard.fieldStockHint')}
              className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none"
              style={field}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('creatorDashboard.fieldType')}</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field}>
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt} disabled={opt !== 'idea' && !canRunFullShop}>
                  {t(`shop.${opt}`)}{opt !== 'idea' && !canRunFullShop ? ` (${t('creatorDashboard.sellerOnly')})` : ''}
                </option>
              ))}
            </select>
            {!canRunFullShop && (
              <Link href="/shop/become-seller" className="text-xs mt-1 inline-block underline" style={{ color: C.brown }}>
                {t('creatorDashboard.becomeSellerLink')}
              </Link>
            )}
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('creatorDashboard.fieldCategory')}</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field}>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {t(`shop.cat${opt.charAt(0).toUpperCase()}${opt.slice(1)}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {type === 'idea' && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('creatorDashboard.fieldIdeaKind')}</label>
              <select value={ideaKind} onChange={(e) => setIdeaKind(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field}>
                {IDEA_KIND_OPTIONS.map((opt) => (
                  <option key={opt || 'plain'} value={opt}>
                    {opt ? `${IDEA_KIND_ICONS[opt] ?? ''} ${t(`shop.ideaKind.${opt}`)}` : t('creatorDashboard.ideaKindPlain')}
                  </option>
                ))}
              </select>
            </div>
            {ideaKind === 'bottle' && (
              <div>
                <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('creatorDashboard.fieldUnlockAt')}</label>
                <input
                  type="datetime-local"
                  value={unlockAt}
                  onChange={(e) => setUnlockAt(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none"
                  style={field}
                />
              </div>
            )}
          </div>
        )}

        <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('creatorDashboard.fieldDownloadUrl')}</label>
        <input value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none" style={field} placeholder="https://…" />

        <label className="text-sm font-medium mt-1 block" style={{ color: C.text2 }}>
          {t('creatorDashboard.fieldImage')} <span className="font-normal opacity-70">(optional)</span>
        </label>
        <div className="mt-1 mb-3 rounded-xl overflow-hidden" style={{ border: `1px dashed ${C.line}`, background: C.white }}>
          {imagePreview ? (
            <div className="relative h-36 bg-center bg-cover" style={{ backgroundImage: `url(${imagePreview})` }}>
              <button
                type="button"
                onClick={() => onImageChange(null)}
                className="absolute top-2 right-2 rounded-lg px-2 py-1 text-xs font-semibold"
                style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-1 h-28 cursor-pointer px-4 text-center">
              <span className="text-sm font-semibold" style={{ color: C.brown }}>Upload image</span>
              <span className="text-xs" style={{ color: C.text2 }}>JPG, PNG, WebP or GIF · max 5MB</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file && file.size > 5 * 1024 * 1024) {
                    setError('Cover image must be 5MB or smaller.');
                    e.target.value = '';
                    return;
                  }
                  setError('');
                  onImageChange(file);
                }}
              />
            </label>
          )}
        </div>

        {error && <div className="text-sm mt-1 mb-2" style={{ color: '#c0392b' }}>{error}</div>}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-3 font-semibold"
            style={{ background: C.card, color: C.text }}
          >
            {t('creatorDashboard.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl py-3 font-semibold text-white disabled:opacity-60"
            style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}
          >
            {saving ? t('creatorDashboard.saving') : t('creatorDashboard.save')}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
