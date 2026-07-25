'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import AppShell from '@/components/AppShell';
import RelativeTime from '@/components/RelativeTime';
import {
  fetchCommunityWikiPage,
  type CommunityWikiPage,
} from '@/lib/communityApi';

export default function CommunityWikiDetailPage() {
  const params = useParams();
  const rawSlug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const rawPageSlug = Array.isArray(params.pageSlug) ? params.pageSlug[0] : params.pageSlug;
  const slug = rawSlug ? decodeURIComponent(rawSlug) : '';
  const pageSlug = rawPageSlug ? decodeURIComponent(rawPageSlug) : '';

  const [page, setPage] = useState<CommunityWikiPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!slug || !pageSlug) return;
    setLoading(true);
    setNotFound(false);
    try {
      const wikiPage = await fetchCommunityWikiPage(slug, pageSlug);
      setPage(wikiPage);
      setNotFound(!wikiPage);
    } finally {
      setLoading(false);
    }
  }, [pageSlug, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-2xl mx-auto px-4 pb-16">
      {loading ? (
        <div className="py-16 text-center text-text-secondary">Loading wiki page...</div>
      ) : notFound || !page ? (
        <div className="py-16 text-center text-text-secondary">
          <p>Wiki page not found.</p>
          <Link href={`/communities/${encodeURIComponent(slug)}`} className="mt-3 inline-flex text-sm font-semibold text-vault">
            Back to community
          </Link>
        </div>
      ) : (
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <Link
            href={`/communities/${encodeURIComponent(slug)}`}
            className="mb-4 inline-flex text-sm font-semibold text-vault hover:underline"
          >
            Back to c/{slug}
          </Link>
          <header className="mb-5 border-b border-surface pb-4">
            <h1 className="text-2xl font-bold text-text">{page.title}</h1>
            {(page.edited_at || page.edited_by) && (
              <p className="mt-2 text-xs text-text-secondary">
                {page.edited_by ? `Edited by @${page.edited_by}` : 'Edited'}
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
            {page.body || 'No wiki content yet.'}
          </div>
        </motion.article>
      )}
    </AppShell>
  );
}
