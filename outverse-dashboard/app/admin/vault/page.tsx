'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { deleteBottle, fetchBottlesAdmin } from '@/lib/adminApi';
import type { AdminBottle } from '@/lib/adminTypes';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

export default function AdminVaultPage() {
  const confirm = useConfirm();
  const [bottles, setBottles] = useState<AdminBottle[]>([]);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    fetchBottlesAdmin().then(setBottles).catch(() => setMsg('Failed to load bottles'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const drifting = bottles.filter((b) => !b.is_opened && !b.caught_by).length;
  const caught = bottles.filter((b) => b.caught_by).length;

  return (
    <AdminShell title="Vault (Bottles)" subtitle="Drifting messages across the cosmic sea">
      {msg && <div className="admin-alert admin-alert--error">{msg}</div>}

      <div className="admin-kpi-grid">
        <div className="admin-kpi admin-kpi--warm">
          <div className="admin-kpi__label">Total bottles</div>
          <div className="admin-kpi__value">{bottles.length}</div>
        </div>
        <div className="admin-kpi admin-kpi--warm">
          <div className="admin-kpi__label">Drifting</div>
          <div className="admin-kpi__value">{drifting}</div>
        </div>
        <div className="admin-kpi admin-kpi--warm">
          <div className="admin-kpi__label">Caught</div>
          <div className="admin-kpi__value">{caught}</div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Emotion</th>
                <th>Message</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bottles.map((b) => (
                <tr key={b.id}>
                  <td>#{b.id}</td>
                  <td>{b.emotion_type}</td>
                  <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.message}
                  </td>
                  <td>
                    {b.caught_by ? (
                      <span className="admin-badge admin-badge--approved">Caught</span>
                    ) : b.is_opened ? (
                      <span className="admin-badge admin-badge--pending">Opened</span>
                    ) : (
                      <span className="admin-badge admin-badge--active">Drifting</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      onClick={async () => {
                        if (!(await confirm('Remove this bottle?', { danger: true, confirmLabel: 'Remove' }))) return;
                        const res = await deleteBottle(b.id);
                        if (res.ok) {
                          setMsg('Bottle removed.');
                          load();
                        }
                      }}
                    >
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
