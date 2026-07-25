'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import { apiFetch } from '@/lib/api';
import { mapPost, type ApiPost } from '@/utils/postMapper';

type PublicCollection = {
  id: number;
  name: string;
  description?: string;
  item_count?: number;
};

type BoardResponse = {
  collection?: PublicCollection;
  items?: ApiPost[];
};

export default function BoardPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [collection, setCollection] = useState<PublicCollection | null>(null);
  const [items, setItems] = useState<ApiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`collections/${id}/public/`);
      if (!res.ok) throw new Error('failed');
      const data = (await res.json()) as BoardResponse;
      setCollection(data.collection || null);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setCollection(null);
      setItems([]);
      setError('This board is not public or could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const pins = useMemo(
    () =>
      items
        .map((post) => {
          const mapped = mapPost(post);
          return {
            id: mapped.id,
            text: mapped.text,
            image: mapped.images[0] || null,
            author: mapped.user.name,
          };
        })
        .filter((post): post is { id: number; text: string; image: string; author: string } => !!post.id && !!post.image),
    [items],
  );

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-6xl mx-auto px-4 pb-16">
      <div className="pt-4">
        <Link href="/saved" className="text-sm font-semibold text-vault hover:underline">
          Back to saved
        </Link>

        {loading ? (
          <p className="py-16 text-center text-sm text-text-secondary">Loading board...</p>
        ) : error || !collection ? (
          <p className="py-16 text-center text-sm text-text-secondary">{error || 'Board not found.'}</p>
        ) : (
          <>
            <header className="my-6 rounded-[28px] border border-surface bg-surface/30 p-6">
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-vault">
                <Squares2X2Icon className="h-4 w-4" />
                Public board
              </p>
              <h1 className="text-3xl font-bold">{collection.name}</h1>
              {collection.description ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">{collection.description}</p>
              ) : null}
              <p className="mt-3 text-xs text-text-secondary">{collection.item_count ?? pins.length} saved posts</p>
            </header>

            {pins.length === 0 ? (
              <p className="rounded-2xl border border-surface bg-surface/20 p-8 text-center text-sm text-text-secondary">
                This board does not have public image posts yet.
              </p>
            ) : (
              <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
                {pins.map((pin, index) => (
                  <Link
                    key={pin.id}
                    href={`/post/${pin.id}`}
                    className="mb-3 block break-inside-avoid overflow-hidden rounded-2xl border border-surface bg-surface/30 transition hover:-translate-y-0.5 hover:border-vault/40"
                  >
                    <Image
                      src={pin.image}
                      alt={pin.text || `Board image ${index + 1}`}
                      width={520}
                      height={index % 3 === 0 ? 680 : 520}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="h-auto w-full object-cover"
                      unoptimized
                    />
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm font-medium">{pin.text || 'Untitled post'}</p>
                      <p className="mt-1 truncate text-xs text-text-secondary">{pin.author}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
