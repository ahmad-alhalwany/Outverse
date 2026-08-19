'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { fetchSellerApplications, reviewSellerApplication } from '@/lib/adminApi';
import type { AdminSellerApplication } from '@/lib/adminTypes';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

export default function AdminSellerApplicationsPage() {
  const confirm = useConfirm();
  const [requests, setRequests] = useState<AdminSellerApplication[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    fetchSellerApplications()
      .then(setRequests)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: number, action: 'approve' | 'reject') => {
    if (!(await confirm(
      action === 'approve' ? 'Approve this seller application?' : 'Reject this seller application?',
      { danger: action === 'reject', confirmLabel: action === 'approve' ? 'Approve' : 'Reject' },
    ))) return;
    setBusy(id);
    try {
      const res = await reviewSellerApplication(id, action);
      if (res.ok) setRequests((prev) => prev.filter((r) => r.id !== id));
      else {
        const data = await res.json().catch(() => null);
        setError(data?.detail || data?.error || 'Action failed');
      }
    } catch {
      setError('Action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminShell title="Seller Applications" subtitle={`${requests.length} pending`}>
      {error && <div className="admin-alert admin-alert--error">{error}</div>}
      <div className="admin-panel">
        <div className="admin-table-wrap admin-table--desktop">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Reason</th>
                <th>Links</th>
                <th>Requested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--admin-muted)' }}>No pending seller applications</td>
                </tr>
              ) : (
                requests.map((item) => (
                  <tr key={item.id}>
                    <td>@{item.username}</td>
                    <td style={{ maxWidth: 320 }}>{item.reason}</td>
                    <td style={{ maxWidth: 220, wordBreak: 'break-all' }}>{item.links}</td>
                    <td>{new Date(item.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn admin-btn--success"
                        style={{ marginRight: 6 }}
                        disabled={busy === item.id}
                        onClick={() => act(item.id, 'approve')}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--danger"
                        disabled={busy === item.id}
                        onClick={() => act(item.id, 'reject')}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="admin-mobile-cards">
          {requests.map((item) => (
            <div key={item.id} className="admin-mobile-card">
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">User</span><span className="admin-mobile-card__value">@{item.username}</span></div>
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Reason</span><span className="admin-mobile-card__value">{item.reason}</span></div>
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Links</span><span className="admin-mobile-card__value">{item.links}</span></div>
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Requested</span><span className="admin-mobile-card__value">{new Date(item.created_at).toLocaleDateString()}</span></div>
              <div className="admin-actions-wrap">
                <button type="button" className="admin-btn admin-btn--success" disabled={busy === item.id} onClick={() => act(item.id, 'approve')}>Approve</button>
                <button type="button" className="admin-btn admin-btn--danger" disabled={busy === item.id} onClick={() => act(item.id, 'reject')}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
