'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useLocale } from './LocaleProvider';
import {
  COSMIC_REACTIONS,
  EMOJI_BY_REACTION_TYPE,
  reactionLabelKey,
  type ReactionType,
} from '@/lib/reactions';
import {
  fetchReactors,
  type ReactionContentType,
  type ReactorRow,
} from '@/lib/reactionsApi';
import { mediaUrl } from '@/lib/api';
import { publicDisplayName, looksLikeEmail } from '@/lib/publicDisplayName';
import { useDialogA11y } from '@/lib/hooks/useDialogA11y';

type Props = {
  open: boolean;
  onClose: () => void;
  contentType: ReactionContentType;
  contentId: number;
  initialFilter?: ReactionType | 'all';
};

export default function ReactorsModal({
  open,
  onClose,
  contentType,
  contentId,
  initialFilter = 'all',
}: Props) {
  const { t } = useLocale();
  const [filter, setFilter] = useState<ReactionType | 'all'>(initialFilter);
  const [rows, setRows] = useState<ReactorRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!contentId) return;
    setLoading(true);
    const data = await fetchReactors(
      contentType,
      contentId,
      filter === 'all' ? undefined : filter,
    );
    setRows(data?.results ?? []);
    setCounts(data?.reaction_counts ?? {});
    setLoading(false);
  }, [contentId, contentType, filter]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    setFilter(initialFilter);
  }, [open, initialFilter]);

  const dialogRef = useDialogA11y<HTMLDivElement>(open, onClose);

  const tabs = COSMIC_REACTIONS.filter((r) => (counts[r.type] ?? 0) > 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="reactors-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('reactions.whoReacted')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            className="reactors-modal"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="reactors-modal__head">
              <h3>{t('reactions.whoReacted')}</h3>
              <button type="button" onClick={onClose} aria-label={t('inspiration.close')}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="reactors-modal__tabs">
              <button
                type="button"
                className={`reactors-modal__tab${filter === 'all' ? ' reactors-modal__tab--on' : ''}`}
                onClick={() => setFilter('all')}
              >
                {t('reactions.all')}
              </button>
              {tabs.map((r) => (
                <button
                  key={r.type}
                  type="button"
                  className={`reactors-modal__tab${filter === r.type ? ' reactors-modal__tab--on' : ''}`}
                  onClick={() => setFilter(r.type)}
                >
                  {r.emoji} {counts[r.type] ?? 0}
                </button>
              ))}
            </div>

            <div className="reactors-modal__list">
              {loading ? (
                <p className="reactors-modal__empty">{t('common.loading')}</p>
              ) : rows.length === 0 ? (
                <p className="reactors-modal__empty">{t('reactions.noReactors')}</p>
              ) : (
                rows.map((row) => {
                  const avatar = mediaUrl(row.user.avatar) || row.user.avatar;
                  const name = publicDisplayName(row.user);
                  const handle = looksLikeEmail(row.user.username)
                    ? null
                    : row.user.username;
                  return (
                    <div key={`${row.user.id}-${row.created_at}`} className="reactors-modal__row">
                      {avatar ? (
                        <Image
                          src={avatar}
                          alt=""
                          width={40}
                          height={40}
                          className="reactors-modal__avatar"
                        />
                      ) : (
                        <span className="reactors-modal__avatar reactors-modal__avatar--fallback">
                          {name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="reactors-modal__name">{name}</p>
                        {handle ? (
                          <p className="reactors-modal__meta">@{handle}</p>
                        ) : null}
                      </div>
                      <span className="reactors-modal__emoji" title={t(reactionLabelKey(row.type))}>
                        {EMOJI_BY_REACTION_TYPE[row.type]}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
