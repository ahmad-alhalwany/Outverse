'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import QuotedPost from './QuotedPost';
import { useLocale } from './LocaleProvider';

interface QuoteComposerProps {
  original: {
    id?: number;
    user?: { id?: number; name?: string; avatar?: string };
    text?: string;
    time?: string;
    images?: string[];
  };
  busy?: boolean;
  onSubmit: (text: string) => void;
  onClose: () => void;
}

export default function QuoteComposer({ original, busy, onSubmit, onClose }: QuoteComposerProps) {
  const { t } = useLocale();
  const [text, setText] = useState('');

  return (
    <div className="quote-composer__overlay" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.2 }}
        className="quote-composer"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="quote-composer__header">
          <h3 className="quote-composer__title">{t('feed.quoteTitle')}</h3>
          <button type="button" onClick={onClose} className="quote-composer__close" aria-label={t('common.close')}>
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('feed.quotePlaceholder')}
          rows={3}
          className="quote-composer__input"
        />
        <div className="quote-composer__embed">
          <QuotedPost {...original} />
        </div>
        <div className="quote-composer__footer">
          <button type="button" onClick={onClose} className="quote-composer__cancel">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onSubmit(text)}
            disabled={busy || !text.trim()}
            className="quote-composer__submit"
          >
            {busy ? t('feed.quoteSubmitting') : t('feed.quoteSubmit')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
