'use client';

import { useEffect, useRef, useState } from 'react';
import { FolderPlusIcon, PlusIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useLocale } from './LocaleProvider';
import {
  fetchCollections,
  createCollection,
  saveToCollection,
  type SavedCollection,
} from '@/lib/postsApi';

interface SaveToCollectionMenuProps {
  postId: number;
  onSaved?: (saved: boolean) => void;
}

/**
 * Popover to file a post into a named collection, or create a new one inline.
 */
export default function SaveToCollectionMenu({ postId, onSaved }: SaveToCollectionMenuProps) {
  const { t } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<SavedCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [savedInto, setSavedInto] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    fetchCollections()
      .then(setCollections)
      .finally(() => setLoading(false));
    const tFocus = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(tFocus);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleSaveInto = async (collectionId: number) => {
    const result = await saveToCollection(postId, collectionId);
    if (result) {
      setSavedInto(collectionId);
      onSaved?.(result.saved);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError('');
    try {
      const created = await createCollection(name, newIsPublic);
      if (created) {
        setCollections((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
        setNewName('');
        setNewIsPublic(false);
        await handleSaveInto(created.id);
      } else {
        setError(t('collections.createFailed'));
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="collection-menu" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-full text-text-secondary hover:text-vault hover:bg-surface transition"
        title={t('collections.saveTo')}
        aria-label={t('collections.saveTo')}
        aria-expanded={open}
      >
        <FolderPlusIcon className="h-5 w-5" />
      </button>
      {open && (
        <div className="collection-menu__panel" role="dialog" aria-label={t('collections.saveTo')}>
          <p className="collection-menu__title">{t('collections.saveTo')}</p>

          {loading && <p className="collection-menu__empty">{t('common.loading')}</p>}

          {!loading && collections.length === 0 && (
            <p className="collection-menu__empty">{t('collections.emptyHint')}</p>
          )}

          {!loading && collections.length > 0 && (
            <div className="collection-menu__list">
              {collections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void handleSaveInto(c.id)}
                  className="collection-menu__item"
                >
                  <span className="min-w-0 truncate text-left">
                    {c.name}
                    {c.is_public ? (
                      <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-vault">
                        {t('collections.publicBadge')}
                      </span>
                    ) : null}
                  </span>
                  {savedInto === c.id ? (
                    <CheckIcon className="h-4 w-4 shrink-0 text-vault" />
                  ) : (
                    <span className="collection-menu__count">{c.item_count}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="collection-menu__create">
            <label className="collection-menu__create-label" htmlFor={`collection-new-${postId}`}>
              {t('collections.newLabel')}
            </label>
            <input
              id={`collection-new-${postId}`}
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCreate();
                }
                if (e.key === 'Escape') setOpen(false);
              }}
              placeholder={t('collections.newPlaceholder')}
              className="collection-menu__input"
              maxLength={80}
              autoComplete="off"
            />
            <label className="collection-menu__public">
              <input
                type="checkbox"
                checked={newIsPublic}
                onChange={(e) => setNewIsPublic(e.target.checked)}
              />
              <span>{t('collections.makePublic')}</span>
            </label>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={creating || !newName.trim()}
              className="collection-menu__add"
            >
              <PlusIcon className="h-4 w-4" />
              <span>{creating ? t('common.loading') : t('collections.create')}</span>
            </button>
            {error ? <p className="collection-menu__error">{error}</p> : null}
          </div>
        </div>
      )}
    </div>
  );
}
