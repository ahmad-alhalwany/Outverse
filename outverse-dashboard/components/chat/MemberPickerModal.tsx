'use client';

import { useMemo, useState } from 'react';

type PickerCandidate = {
  id: number;
  username: string;
  name: string;
  avatar: string | null;
};

type Props = {
  title: string;
  candidates: PickerCandidate[];
  confirmLabel: string;
  showNameField?: boolean;
  initialName?: string;
  onConfirm: (memberIds: number[], name: string) => void;
  onClose: () => void;
};

export default function MemberPickerModal({
  title,
  candidates,
  confirmLabel,
  showNameField = false,
  initialName = '',
  onConfirm,
  onClose,
}: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [name, setName] = useState(initialName);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) => c.username.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [candidates, query]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    if (showNameField && !name.trim()) return;
    onConfirm(Array.from(selected), name.trim());
  }

  return (
    <div className="cosmic-modal-overlay" onClick={onClose}>
      <div className="cosmic-modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="cosmic-modal-title">{title}</h2>
        {showNameField && (
          <input
            type="text"
            className="cosmic-modal-input"
            placeholder="Room name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        )}
        <input
          type="text"
          className="cosmic-modal-input"
          placeholder="Search friends…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="cosmic-modal-list">
          {filtered.length === 0 && <p className="cosmic-modal-empty">No friends found.</p>}
          {filtered.map((c) => (
            <label key={c.id} className="cosmic-modal-row">
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
              />
              {c.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.avatar} alt="" className="cosmic-modal-avatar" />
              ) : (
                <div className="cosmic-modal-avatar cosmic-modal-avatar--fallback">
                  {c.username.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="cosmic-modal-name">{c.name || c.username}</span>
            </label>
          ))}
        </div>
        <div className="cosmic-modal-actions">
          <button type="button" className="cosmic-modal-btn cosmic-modal-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="cosmic-modal-btn cosmic-modal-btn--primary"
            onClick={confirm}
            disabled={showNameField && !name.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
