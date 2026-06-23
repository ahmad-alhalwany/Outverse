'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { deleteReel, fetchReelsAdmin, patchReel } from '@/lib/adminApi';
import type { AdminReel } from '@/lib/adminTypes';

export default function AdminReelsPage() {
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
  };

  const toggleActive = async (reel: AdminReel) => {
    const res = await patchReel(reel.id, { is_active: !reel.is_active } as Partial<AdminReel>);
    if (res.ok) load();
  };

  const remove = async (id: number) => {
    if (!window.confirm('Delete this signal permanently?')) return;
    const res = await deleteReel(id);
    if (res.ok) {
      setMsg('Signal deleted.');
      load();
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
        <div className="admin-table-wrap">
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
      </div>
    </AdminShell>
  );
}
