'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import AppShell from '@/components/AppShell';
import RelativeTime from '@/components/RelativeTime';
import { useLocale } from '@/components/LocaleProvider';
import {
  fetchCommunity,
  fetchCommunityWikiPage,
  createOrUpdateWikiPage,
  type CommunityWikiPage,
} from '@/lib/communityApi';

export default function CommunityWikiDetailPage() {
  const { t } = useLocale();
  const params = useParams();
  const rawSlug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const rawPageSlug = Array.isArray(params.pageSlug) ? params.pageSlug[0] : params.pageSlug;
  const slug = rawSlug ? decodeURIComponent(rawSlug) : '';
  const pageSlug = rawPageSlug ? decodeURIComponent(rawPageSlug) : '';

  const [page, setPage] = useState<CommunityWikiPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const load = useCallback(async () => {
    if (!slug || !pageSlug) return;
    setLoading(true);
    setNotFound(false);
    try {
      const [wikiPage, community] = await Promise.all([
        fetchCommunityWikiPage(slug, pageSlug),
        fetchCommunity(slug),
      ]);
      setPage(wikiPage);
      setNotFound(!wikiPage);
      setIsModerator(!!community?.is_moderator);
    } finally {
      setLoading(false);
    }
  }, [pageSlug, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = () => {
    if (!page) return;
    setTitleDraft(page.title);
    setBodyDraft(page.body);
    setSaveError('');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!titleDraft.trim() || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const saved = await createOrUpdateWikiPage(slug, {
        title: titleDraft.trim(),
        body: bodyDraft,
        slug: pageSlug,
      });
      if (saved) {
        setPage(saved);
        setEditing(false);
      } else {
        setSaveError(t('communities.wikiSaveFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-2xl mx-auto px-4 pb-16">
      {loading ? (
        <div className="py-16 text-center text-text-secondary">{t('communities.wikiLoading')}</div>
      ) : notFound || !page ? (
        <div className="py-16 text-center text-text-secondary">
          <p>{t('communities.wikiNotFound')}</p>
          <Link href={`/communities/${encodeURIComponent(slug)}`} className="mt-3 inline-flex text-sm font-semibold text-vault">
            {t('communities.wikiBackToCommunity')}
          </Link>
        </div>
      ) : (
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <Link
              href={`/communities/${encodeURIComponent(slug)}`}
              className="inline-flex text-sm font-semibold text-vault hover:underline"
            >
              {t('communities.wikiBackTo', { slug })}
            </Link>
            {isModerator && !editing && (
              <button
                type="button"
                onClick={startEdit}
                className="text-xs font-semibold text-vault"
              >
                {t('communities.editWikiPage')}
              </button>
            )}
          </div>
          {editing ? (
            <div className="space-y-2">
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                placeholder={t('communities.wikiTitleLabel')}
                className="w-full rounded-lg border border-surface bg-background px-3 py-2 text-sm"
              />
              <textarea
                value={bodyDraft}
                onChange={(e) => setBodyDraft(e.target.value)}
                placeholder={t('communities.wikiBodyLabel')}
                rows={10}
                className="w-full rounded-lg border border-surface bg-background px-3 py-2 text-sm"
              />
              {saveError && <p className="text-xs text-red-500">{saveError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={saving || !titleDraft.trim()}
                  onClick={() => void saveEdit()}
                  className="rounded-lg bg-vault px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {saving ? t('communities.wikiSaving') : t('communities.wikiSave')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <header className="mb-5 border-b border-surface pb-4">
                <h1 className="text-2xl font-bold text-text">{page.title}</h1>
                {(page.edited_at || page.edited_by) && (
                  <p className="mt-2 text-xs text-text-secondary">
                    {page.edited_by ? t('communities.wikiEditedBy', { user: page.edited_by }) : t('communities.wikiEdited')}
                    {page.edited_at && (
                      <>
                        {' '}
                        <RelativeTime date={page.edited_at} />
                      </>
                    )}
                  </p>
                )}
              </header>
              <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm leading-7 text-text-secondary">
                {page.body || t('communities.wikiNoContent')}
              </div>
            </>
          )}
        </motion.article>
      )}
    </AppShell>
  );
}
