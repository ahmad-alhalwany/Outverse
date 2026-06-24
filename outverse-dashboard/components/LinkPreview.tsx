import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

interface LinkPreviewProps {
  url: string;
}

type LinkPreviewData = {
  url?: string;
  title?: string;
  description?: string;
  image?: { url?: string } | string | null;
};

const previewCache = new Map<string, LinkPreviewData | null>();

export default function LinkPreview({ url }: LinkPreviewProps) {
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!url) {
      setData(null);
      setLoading(false);
      setError(false);
      return;
    }
    if (previewCache.has(url)) {
      setData(previewCache.get(url) ?? null);
      setLoading(false);
      setError(previewCache.get(url) == null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(false);

    debounceRef.current = window.setTimeout(() => {
      fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, { signal: controller.signal })
        .then(res => res.json())
        .then(res => {
          previewCache.set(url, res.data ?? null);
          setData(res.data ?? null);
          setLoading(false);
        })
        .catch((fetchError: Error) => {
          if (fetchError.name === 'AbortError') return;
          previewCache.set(url, null);
          setError(true);
          setLoading(false);
        });
    }, 250);

    return () => {
      controller.abort();
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [url]);

  if (loading) return <div className="rounded-lg bg-surface/60 p-3 my-2 animate-pulse">Loading preview...</div>;
  if (error || !data) return null;

  return (
    <a href={data.url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-surface/40 bg-surface/80 p-3 my-2 shadow hover:shadow-lg transition group">
      {data.image && (
        <Image src={typeof data.image === 'string' ? data.image : data.image.url || ''} alt={data.title || 'Link preview image'} width={64} height={64} className="w-16 h-16 object-cover rounded-md border" unoptimized />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-text truncate group-hover:underline">{data.title || data.url}</div>
        <div className="text-xs text-text-secondary truncate">{data.description}</div>
        <div className="text-xs text-lab mt-1 truncate">{data.url}</div>
      </div>
    </a>
  );
} 