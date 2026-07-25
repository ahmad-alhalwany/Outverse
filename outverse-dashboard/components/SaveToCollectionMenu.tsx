'use client';

import { useEffect, useState } from 'react';
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
 * A small popover that lets the user file a post into a named folder
 * (Instagram-style saved collections), or create a new folder inline.
 */
export default function SaveToCollectionMenu({ postId, onSaved }: SaveToCollectionMenuProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<SavedCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [savedInto, setSavedInto] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchCollections()
      .then(setCollections)
      .finally(() => setLoading(false));
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
    if (!name) return;
    setCreating(true);
    try {
      const created = await createCollection(name, newIsPublic);
      if (created) {
        setCollections((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
        setNewName('');
        setNewIsPublic(false);
        await handleSaveInto(created.id);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="collection-menu">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="p-1.5 rounded-full text-text-secondary hover:text-vault hover:bg-surface transition"
        title={t('collections.saveTo')}
        aria-label={t('collections.saveTo')}
        aria-expanded={open}
      >
        <FolderPlusIcon className="h-5 w-5" />
      </button>
      {open && (
        <div className="collection-menu__panel" onMouseDown={(e) => e.preventDefault()}>
          <p className="collection-menu__title">{t('collections.saveTo')}</p>
          {loading && <p className="collection-menu__empty">{t('common.loading')}</p>}
          {!loading && collections.length === 0 && (
            <p className="collection-menu__empty">{t('collections.empty')}</p>
          )}
          <div className="collection-menu__list">
            {collections.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSaveInto(c.id)}
                className="collection-menu__item"
              >
                <span className="truncate">
                  {c.name}
                  {c.is_public ? <span className="ml-1 text-[10px] uppercase text-vault">Public</span> : null}
                </span>
                {savedInto === c.id ? (
                  <CheckIcon className="h-4 w-4 text-vault" />
                ) : (
                  <span className="collection-menu__count">{c.item_count}</span>
                )}
              </button>
            ))}
          </div>
          <div className="collection-menu__create">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
              placeholder={t('collections.newPlaceholder')}
              className="collection-menu__input"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="collection-menu__add"
              aria-label={t('collections.create')}
            >
              <PlusIcon className="h-4 w-4" />
            </button>
            <label className="col-span-full flex items-center gap-2 text-[11px] text-text-secondary">
              <input
                type="checkbox"
                checked={newIsPublic}
                onChange={(e) => setNewIsPublic(e.target.checked)}
              />
              Make public board
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
