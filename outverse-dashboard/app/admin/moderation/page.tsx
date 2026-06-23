'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { fetchFlagged, patchFlagged } from '@/lib/adminApi';
import type { AdminFlagged } from '@/lib/adminTypes';

const TYPE_LABEL: Record<string, string> = {
  post: 'Post',
  comment: 'Comment',
  reel: 'Signal',
  reel_comment: 'Signal comment',
};

export default function AdminModerationPage() {
  const [flagged, setFlagged] = useState<AdminFlagged[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    fetchFlagged()
      .then(setFlagged)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: number, status: 'approved' | 'rejected') => {
    setBusy(id);
    try {
      const res = await patchFlagged(id, status);
      if (res.ok) load();
      else setError('Action failed');
    } catch {
      setError('Action failed');
    } finally {
      setBusy(null);
    }
  };

  const pending = flagged.filter((f) => f.status === 'pending').length;

  return (
    <AdminShell title="Content Moderation" subtitle={`${pending} pending reports`}>
      {error && <div className="admin-alert admin-alert--error">{error}</div>}
      <div className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Content</th>
                <th>Reporter</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flagged.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--admin-muted)' }}>No flagged content</td>
                </tr>
              ) : (
                flagged.map((item) => (
                  <tr key={item.id}>
                    <td>{TYPE_LABEL[item.type] || item.type}</td>
                    <td style={{ maxWidth: 320 }}>{item.content}</td>
                    <td>{item.reporter}</td>
                    <td>
                      <span className={`admin-badge admin-badge--${item.status}`}>{item.status}</span>
                    </td>
                    <td>
                      {item.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            className="admin-btn admin-btn--success"
                            style={{ marginRight: 6 }}
                            disabled={busy === item.id}
                            onClick={() => act(item.id, 'approved')}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--danger"
                            disabled={busy === item.id}
                            onClick={() => act(item.id, 'rejected')}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
