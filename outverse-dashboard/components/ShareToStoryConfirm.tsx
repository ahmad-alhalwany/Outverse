'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useLocale } from '@/components/LocaleProvider';
import { mediaUrl } from '@/lib/api';

export type StoryShareDraft = {
  text: string;
  audience: 'everyone' | 'close_friends';
};

type Props = {
  open: boolean;
  mediaUrl: string;
  mediaKind?: 'image' | 'video';
  initialText?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (draft: StoryShareDraft) => void | Promise<void>;
};

/** Preview + caption before broadcasting content into the 24h story ring. */
export default function ShareToStoryConfirm({
  open,
  mediaUrl: rawMedia,
  mediaKind = 'image',
  initialText = '',
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useLocale();
  const [mounted, setMounted] = useState(false);
  const [text, setText] = useState(initialText);
  const [audience, setAudience] = useState<'everyone' | 'close_friends'>('everyone');
  const preview = mediaUrl(rawMedia) || rawMedia;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setText(initialText.slice(0, 200));
    setAudience('everyone');
  }, [open, initialText]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="story-share-confirm" role="dialog" aria-modal="true" aria-label={t('feed.shareStoryConfirmTitle')}>
      <button type="button" className="story-share-confirm__backdrop" aria-label={t('common.close')} onClick={() => !busy && onClose()} />
      <div className="story-share-confirm__panel">
        <header className="story-share-confirm__header">
          <div>
            <h3 className="story-share-confirm__title">{t('feed.shareStoryConfirmTitle')}</h3>
            <p className="story-share-confirm__sub">{t('feed.shareStoryConfirmSub')}</p>
          </div>
          <button
            type="button"
            className="story-share-confirm__close"
            onClick={() => !busy && onClose()}
            aria-label={t('common.close')}
            disabled={busy}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="story-share-confirm__preview">
          {mediaKind === 'video' ? (
            <video src={preview} className="story-share-confirm__media" muted playsInline controls={false} />
          ) : (
            <Image
              src={preview}
              alt=""
              width={360}
              height={640}
              className="story-share-confirm__media"
              unoptimized
            />
          )}
        </div>

        <label className="story-share-confirm__label" htmlFor="story-share-caption">
          {t('feed.shareStoryCaption')}
        </label>
        <textarea
          id="story-share-caption"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 200))}
          placeholder={t('feed.shareStoryCaptionPlaceholder')}
          rows={3}
          className="story-share-confirm__textarea"
          disabled={busy}
        />
        <p className="story-share-confirm__count">{text.length}/200</p>

        <p className="story-share-confirm__label">{t('feed.shareStoryAudience')}</p>
        <div className="story-share-confirm__audience">
          <label className={`story-share-confirm__chip${audience === 'everyone' ? ' is-active' : ''}`}>
            <input
              type="radio"
              name="story-audience"
              checked={audience === 'everyone'}
              onChange={() => setAudience('everyone')}
              disabled={busy}
            />
            {t('feed.shareStoryEveryone')}
          </label>
          <label className={`story-share-confirm__chip${audience === 'close_friends' ? ' is-active' : ''}`}>
            <input
              type="radio"
              name="story-audience"
              checked={audience === 'close_friends'}
              onChange={() => setAudience('close_friends')}
              disabled={busy}
            />
            {t('feed.shareStoryCloseFriends')}
          </label>
        </div>

        <div className="story-share-confirm__actions">
          <button type="button" className="story-share-confirm__cancel" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="story-share-confirm__submit"
            disabled={busy}
            onClick={() => void onConfirm({ text: text.trim(), audience })}
          >
            {busy ? t('feed.shareStoryBusy') : t('feed.shareStoryConfirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
