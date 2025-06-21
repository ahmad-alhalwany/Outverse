import { useEffect, useState } from 'react';

interface LinkPreviewProps {
  url: string;
}

export default function LinkPreview({ url }: LinkPreviewProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
      .then(res => res.json())
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [url]);

  if (loading) return <div className="rounded-lg bg-surface/60 p-3 my-2 animate-pulse">Loading preview...</div>;
  if (error || !data) return null;

  return (
    <a href={data.url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-surface/40 bg-surface/80 p-3 my-2 shadow hover:shadow-lg transition group">
      {data.image && (
        <img src={data.image.url || data.image} alt={data.title} className="w-16 h-16 object-cover rounded-md border" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-text truncate group-hover:underline">{data.title || data.url}</div>
        <div className="text-xs text-text-secondary truncate">{data.description}</div>
        <div className="text-xs text-lab mt-1 truncate">{data.url}</div>
      </div>
    </a>
  );
} 