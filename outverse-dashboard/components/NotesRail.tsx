'use client';

import { useEffect, useState } from 'react';
import { fetchFollowingNotes, type Note } from '@/lib/notesApi';

const themeStyles: Record<string, string> = {
  cosmic: 'from-vault/20 to-bazaar/20 border-vault/30',
  lab: 'from-lab/20 to-green-500/20 border-lab/30',
  bazaar: 'from-bazaar/20 to-orange-500/20 border-bazaar/30',
  forge: 'from-red-500/20 to-amber-500/20 border-red-400/30',
  garden: 'from-emerald-500/20 to-teal-500/20 border-emerald-400/30',
};

export default function NotesRail() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchFollowingNotes();
        if (!cancelled) setNotes(data);
      } catch {
        setNotes([]);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="h-24 rounded-2xl bg-surface/40 animate-pulse mb-6" />;
  }
  if (notes.length === 0) return null;

  const visible = expanded ? notes : notes.slice(0, 3);

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-text">Quick Bursts</h2>
        {notes.length > 3 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-vault hover:text-bazaar"
          >
            {expanded ? 'Show less' : `Show ${notes.length - 3} more`}
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
        {visible.map((note) => {
          const style = themeStyles[note.theme] || themeStyles.cosmic;
          const name = note.user.first_name || note.user.last_name
            ? `${note.user.first_name || ''} ${note.user.last_name || ''}`.trim()
            : note.user.username;
          return (
            <div
              key={note.id}
              className={`shrink-0 w-64 snap-start rounded-2xl p-4 border bg-gradient-to-br ${style}`}
            >
              <p className="text-sm text-text whitespace-pre-wrap line-clamp-4">{note.text}</p>
              <p className="text-xs text-text-secondary mt-2">— {name}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
