'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { deleteReel, fetchReelsAdmin, patchReel } from '@/lib/adminApi';
import type { AdminReel } from '@/lib/adminTypes';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

export default function AdminReelsPage() {
  const confirm = useConfirm();
  const [reels, setReels] = useState<AdminReel[]>([]);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    fetchReelsAdmin().then(setReels).catch(() => setMsg('Failed to load signals'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFeatured = async (reel: AdminReel) => {
    const res = await patchReel(reel.id, { is_featured: !reel.is_featured } as Partial<AdminReel>);
    if (res.ok) load();
    else {
      const data = await res.json().catch(() => null);
      setMsg(data?.detail || data?.error || 'Update failed.');
    }
  };

  const toggleActive = async (reel: AdminReel) => {
    const res = await patchReel(reel.id, { is_active: !reel.is_active } as Partial<AdminReel>);
    if (res.ok) load();
    else {
      const data = await res.json().catch(() => null);
      setMsg(data?.detail || data?.error || 'Update failed.');
    }
  };

  const remove = async (id: number) => {
    if (!(await confirm('Delete this signal permanently?', { danger: true, confirmLabel: 'Delete' }))) return;
    const res = await deleteReel(id);
    if (res.ok) {
      setMsg('Signal deleted.');
      load();
    } else {
      const data = await res.json().catch(() => null);
      setMsg(data?.detail || data?.error || 'Delete failed.');
    }
  };

  return (
    <AdminShell title="Signal Reels" subtitle="Feature, hide, or remove short video signals">
      {msg && <div className="admin-alert admin-alert--success">{msg}</div>}

      <div className="admin-kpi-grid">
        <div className="admin-kpi">
          <div className="admin-kpi__label">Total signals</div>
          <div className="admin-kpi__value">{reels.length}</div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi__label">Featured</div>
          <div className="admin-kpi__value">{reels.filter((r) => r.is_featured).length}</div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi__label">Active</div>
          <div className="admin-kpi__value">{reels.filter((r) => r.is_active).length}</div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-table-wrap admin-table--desktop">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Author</th>
                <th>Caption</th>
                <th>Views</th>
                <th>Likes</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reels.map((reel) => (
                <tr key={reel.id}>
                  <td>#{reel.id}</td>
                  <td>@{reel.user?.username}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {reel.caption || '—'}
                  </td>
                  <td>{reel.views}</td>
                  <td>{reel.likes_count}</td>
                  <td>
                    {reel.is_featured && <span className="admin-badge admin-badge--featured">Featured</span>}
                    {!reel.is_active && <span className="admin-badge admin-badge--rejected">Hidden</span>}
                  </td>
                  <td>
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => toggleFeatured(reel)}>
                      {reel.is_featured ? 'Unfeature' : 'Feature'}
                    </button>
                    <button type="button" className="admin-btn admin-btn--ghost" style={{ marginLeft: 4 }} onClick={() => toggleActive(reel)}>
                      {reel.is_active ? 'Hide' : 'Show'}
                    </button>
                    <button type="button" className="admin-btn admin-btn--danger" style={{ marginLeft: 4 }} onClick={() => remove(reel.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-mobile-cards">
          {reels.map((reel) => (
            <div key={reel.id} className="admin-mobile-card">
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Author</span><span className="admin-mobile-card__value">@{reel.user?.username}</span></div>
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Caption</span><span className="admin-mobile-card__value">{reel.caption || '—'}</span></div>
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Views / Likes</span><span className="admin-mobile-card__value">{reel.views} / {reel.likes_count}</span></div>
              <div className="admin-actions-wrap">
                <button type="button" className="admin-btn admin-btn--ghost" onClick={() => toggleFeatured(reel)}>{reel.is_featured ? 'Unfeature' : 'Feature'}</button>
                <button type="button" className="admin-btn admin-btn--ghost" onClick={() => toggleActive(reel)}>{reel.is_active ? 'Hide' : 'Show'}</button>
                <button type="button" className="admin-btn admin-btn--danger" onClick={() => remove(reel.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
