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

const REASON_LABEL: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  impersonation: 'Impersonation',
  hate: 'Hate speech',
  other: 'Other',
};

export default function AdminModerationPage() {
  const [flagged, setFlagged] = useState<AdminFlagged[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    fetchFlagged()
      .then((data) => {
        setFlagged(data);
        setError('');
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: number, status: 'approved' | 'rejected') => {
    setBusy(id);
    setError('');
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
        <div className="admin-table-wrap admin-table--desktop">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Reason</th>
                <th>Content</th>
                <th>Reporter</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flagged.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--admin-muted)' }}>No flagged content</td>
                </tr>
              ) : (
                flagged.map((item) => (
                  <tr key={item.id}>
                    <td>{TYPE_LABEL[item.type] || item.type}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {item.reason ? (REASON_LABEL[item.reason] || item.reason) : '—'}
                      </div>
                      {item.details ? (
                        <div style={{ color: 'var(--admin-muted)', fontSize: 12, marginTop: 4 }}>
                          {item.details}
                        </div>
                      ) : null}
                    </td>
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
        <div className="admin-mobile-cards">
          {flagged.map((item) => (
            <div key={item.id} className="admin-mobile-card">
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Type</span><span className="admin-mobile-card__value">{TYPE_LABEL[item.type] || item.type}</span></div>
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Reason</span><span className="admin-mobile-card__value">{item.reason ? (REASON_LABEL[item.reason] || item.reason) : '—'}</span></div>
              {item.details ? (
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Details</span><span className="admin-mobile-card__value">{item.details}</span></div>
              ) : null}
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Reporter</span><span className="admin-mobile-card__value">{item.reporter}</span></div>
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Status</span><span className="admin-mobile-card__value">{item.status}</span></div>
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Content</span><span className="admin-mobile-card__value">{item.content}</span></div>
              {item.status === 'pending' ? (
                <div className="admin-actions-wrap">
                  <button type="button" className="admin-btn admin-btn--success" disabled={busy === item.id} onClick={() => act(item.id, 'approved')}>Approve</button>
                  <button type="button" className="admin-btn admin-btn--danger" disabled={busy === item.id} onClick={() => act(item.id, 'rejected')}>Reject</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
