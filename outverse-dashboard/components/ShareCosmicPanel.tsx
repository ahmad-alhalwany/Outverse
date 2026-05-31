'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LinkIcon,
  ShareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useLocale } from './LocaleProvider';

interface ShareCosmicPanelProps {
  postUrl: string;
  postTitle?: string;
  shareCount?: number;
  onClose: () => void;
  onRecordShare?: () => void;
}

function shareLinks(url: string, text: string) {
  const enc = encodeURIComponent(url);
  const encText = encodeURIComponent(text);
  return {
    twitter: `https://twitter.com/intent/tweet?url=${enc}&text=${encText}`,
    whatsapp: `https://wa.me/?text=${encText}%20${enc}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc}`,
    telegram: `https://t.me/share/url?url=${enc}&text=${encText}`,
  };
}

export default function ShareCosmicPanel({
  postUrl,
  postTitle = 'Check this on Outverse',
  shareCount = 0,
  onClose,
  onRecordShare,
}: ShareCosmicPanelProps) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const [recorded, setRecorded] = useState(false);

  const trackShare = () => {
    if (recorded) return;
    setRecorded(true);
    onRecordShare?.();
  };
  const [canNativeShare, setCanNativeShare] = useState(false);
  const links = shareLinks(postUrl, postTitle);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      trackShare();
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* ignore */
    }
  };

  const nativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: postTitle, url: postUrl });
        trackShare();
        onClose();
      } catch {
        /* cancelled */
      }
    } else {
      copyLink();
    }
  };

  const platforms = [
    { name: 'X', icon: '𝕏', href: links.twitter, color: '#000' },
    { name: 'WhatsApp', icon: '💬', href: links.whatsapp, color: '#25D366' },
    { name: 'Facebook', icon: 'f', href: links.facebook, color: '#1877F2' },
    { name: 'Telegram', icon: '✈️', href: links.telegram, color: '#229ED9' },
  ];

  return (
    <motion.div
      className="cosmic-share-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Share post"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="cosmic-share-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="cosmic-share-sheet"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        <div className="cosmic-share-sheet__glow" aria-hidden />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full text-text-secondary hover:text-text hover:bg-surface/50 transition"
          aria-label="Close"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <div className="cosmic-share__bottle" aria-hidden>
          <motion.svg
            width="72"
            height="100"
            viewBox="0 0 100 200"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
          >
            <ellipse cx="50" cy="185" rx="14" ry="8" fill="url(#shareFlame)" opacity="0.8" />
            <defs>
              <radialGradient id="shareFlame">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#f97316" />
              </radialGradient>
              <linearGradient id="shareBody" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#6a00ff" />
              </linearGradient>
            </defs>
            <rect x="32" y="55" width="36" height="90" rx="18" fill="url(#shareBody)" />
            <ellipse cx="50" cy="95" rx="8" ry="9" fill="rgba(255,255,255,0.9)" />
            <ellipse cx="50" cy="42" rx="18" ry="10" fill="#c4b5fd" />
          </motion.svg>
        </div>

        <h2 className="cosmic-share-sheet__title">{t('feed.shareTitle')}</h2>
        <p className="cosmic-share-sheet__sub">
          {shareCount > 0 ? t('feed.shareCount', { count: String(shareCount) }) : ''}
          {t('feed.shareSubtitle')}
        </p>

        <div className="cosmic-share__copy-row">
          <input readOnly className="cosmic-share__url" value={postUrl} aria-label="Post link" />
          <button type="button" className="cosmic-share__copy-btn" onClick={copyLink}>
            {copied ? t('feed.copied') : t('feed.copy')}
          </button>
        </div>

        <div className="cosmic-share__grid">
          {platforms.map((p) => (
            <a
              key={p.name}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="cosmic-share__platform"
              style={{ borderColor: `${p.color}33` }}
              onClick={() => trackShare()}
            >
              <span className="cosmic-share__platform-icon">{p.icon}</span>
              {p.name}
            </a>
          ))}
        </div>

        <button
          type="button"
          onClick={nativeShare}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white border-0 cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #6a00ff, #0891b2)' }}
        >
          <ShareIcon className="h-5 w-5" />
          {canNativeShare ? t('feed.shareDevice') : t('feed.shareCopyInstead')}
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text transition"
        >
          <LinkIcon className="h-4 w-4" />
          {t('feed.copyLinkOnly')}
        </button>
      </motion.div>
    </motion.div>
  );
}
