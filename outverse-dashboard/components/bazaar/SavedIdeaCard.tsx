'use client';

import Link from 'next/link';
import { BookmarkIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import {
  bazaarCategoryLabel,
  bazaarOwnerName,
  type BazaarIdea,
} from '@/lib/bazaarTypes';
import { useLocale } from '@/components/LocaleProvider';
import { mediaUrl } from '@/lib/api';

type Props = {
  idea: BazaarIdea;
  onUnsave?: () => void;
  onToggleSave?: (saved: boolean) => void;
};

export default function SavedIdeaCard({ idea, onUnsave, onToggleSave }: Props) {
  const { t, locale } = useLocale();
  const ownerName = bazaarOwnerName(idea);

  return (
    <article className="rounded-2xl border border-surface bg-surface/40 p-4 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-vault/15 text-vault">
              {bazaarCategoryLabel(idea.category, locale)}
            </span>
            {idea.is_voted ? (
              <span className="inline-flex items-center gap-1 text-xs text-bazaar">
                <HeartSolid className="h-3.5 w-3.5" /> {t('bazaar.supported')}
              </span>
            ) : null}
          </div>
          <Link href={`/bazaar/${idea.id}`} className="block group">
            <h2 className="font-semibold text-text group-hover:text-vault transition line-clamp-2">
              {idea.title}
            </h2>
            <p className="text-sm text-text-secondary mt-1 line-clamp-2">{idea.description}</p>
          </Link>
          <div className="flex items-center gap-2 mt-3 text-xs text-text-secondary">
            <div
              className="w-6 h-6 rounded-full bg-cover bg-center shrink-0"
              style={{
                backgroundImage: idea.owner?.avatar
                  ? `url(${mediaUrl(idea.owner.avatar)})`
                  : undefined,
              }}
            />
            <span>{ownerName}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <HeartIcon className="h-3.5 w-3.5" /> {idea.supporters}
            </span>
          </div>
          {idea.tags && idea.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {idea.tags.slice(0, 4).map((tag) => (
                <Link
                  key={tag}
                  href={`/bazaar?tag=${encodeURIComponent(tag)}`}
                  className="px-2 py-0.5 rounded-md text-xs bg-background text-text-secondary hover:text-vault"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
        {onToggleSave ? (
          <button
            type="button"
            onClick={() => onToggleSave(false)}
            className="p-2 rounded-xl text-vault hover:bg-vault/10 transition shrink-0"
            aria-label={t('bazaar.unsaveIdea')}
            title={t('bazaar.unsaveIdea')}
          >
            <BookmarkSolid className="h-5 w-5" />
          </button>
        ) : (
          <BookmarkIcon className="h-5 w-5 text-vault shrink-0" aria-hidden />
        )}
      </div>
      {onUnsave ? (
        <button
          type="button"
          onClick={onUnsave}
          className="mt-3 text-xs font-medium text-text-secondary hover:text-red-500"
        >
          {t('bazaar.removeFromSaved')}
        </button>
      ) : null}
    </article>
  );
}
