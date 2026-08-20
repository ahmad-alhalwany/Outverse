'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { fetchAdminProfiles, patchProfile, promoteProfileToStaff, toggleShadowBan } from '@/lib/adminApi';
import type { AdminProfile } from '@/lib/adminTypes';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

export default function AdminUsersPage() {
  const confirm = useConfirm();
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [modal, setModal] = useState<{
    profile: AdminProfile;
    action: 'suspend' | 'activate';
  } | null>(null);

  const load = useCallback(() => {
    fetchAdminProfiles().then(setProfiles).catch(() => setMsg('Failed to load users'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = profiles.filter(
    (p) =>
      p.user.username.toLowerCase().includes(search.toLowerCase()) ||
      (p.user.email || '').toLowerCase().includes(search.toLowerCase()),
  );

  const confirmStatusChange = async () => {
    if (!modal) return;
    const status = modal.action === 'suspend' ? 'suspended' : 'active';
    const res = await patchProfile(modal.profile.id, { status });
    if (res.ok) {
      setMsg(`User @${modal.profile.user.username} ${status}.`);
      load();
    } else {
      const data = await res.json().catch(() => null);
      setMsg(data?.error || data?.detail || 'Update failed.');
    }
    setModal(null);
  };

  const promote = async (profile: AdminProfile) => {
    if (!(await confirm(`Grant @${profile.user.username} staff/admin privileges? This cannot be undone from this panel.`, { danger: true, confirmLabel: 'Promote' }))) return;
    const res = await promoteProfileToStaff(profile.user.id);
    if (res.ok) {
      setMsg(`@${profile.user.username} promoted to staff.`);
      load();
    } else {
      const data = await res.json().catch(() => null);
      setMsg(data?.error || data?.detail || 'Promotion failed.');
    }
  };

  const shadowBan = async (profile: AdminProfile) => {
    if (!(await confirm(`Toggle shadow-ban for @${profile.user.username}?`, { danger: true, confirmLabel: 'Toggle' }))) return;
    const result = await toggleShadowBan(profile.user.id);
    if (result.ok) {
      setMsg(
        result.is_shadow_banned
          ? `@${profile.user.username} is now shadow-banned — their posts and signals are hidden from everyone else's feeds and profile view, but they aren't notified.`
          : `Shadow-ban lifted for @${profile.user.username}.`,
      );
    } else {
      setMsg(result.error || 'Shadow-ban toggle failed.');
    }
  };

  return (
    <AdminShell title="User Management" subtitle="Suspend, activate, and review traveler profiles">
      {msg && (
        <div className="admin-alert admin-alert--success">
          {msg}
          <button type="button" style={{ float: 'right', background: 'none', border: 'none', color: 'inherit' }} onClick={() => setMsg('')}>×</button>
        </div>
      )}
      <div className="admin-panel">
        <div className="admin-toolbar">
          <input
            className="admin-input"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span style={{ color: 'var(--admin-muted)', fontSize: '0.8rem' }}>{filtered.length} profiles</span>
        </div>
        <div className="admin-table-wrap admin-table--desktop">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Points</th>
                <th>Achievements</th>
                <th>Status</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>@{p.user.username}</td>
                  <td>{p.user.email}</td>
                  <td>{p.points}</td>
                  <td>{Array.isArray(p.achievements) ? p.achievements.length : 0}</td>
                  <td>
                    <span className={`admin-badge admin-badge--${p.status === 'active' ? 'active' : 'rejected'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>{p.user.id && p.is_staff ? 'Staff' : 'Member'}</td>
                  <td>
                    {!p.is_staff ? (
                      <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void promote(p)} style={{ marginRight: 6 }}>
                        Promote
                      </button>
                    ) : null}
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void shadowBan(p)} style={{ marginRight: 6 }}>
                      Toggle shadow-ban
                    </button>
                    {p.status === 'active' ? (
                      <button type="button" className="admin-btn admin-btn--danger" onClick={() => setModal({ profile: p, action: 'suspend' })}>
                        Suspend
                      </button>
                    ) : (
                      <button type="button" className="admin-btn admin-btn--success" onClick={() => setModal({ profile: p, action: 'activate' })}>
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-mobile-cards">
          {filtered.map((p) => (
            <div key={p.id} className="admin-mobile-card">
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">User</span><span className="admin-mobile-card__value">@{p.user.username}</span></div>
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Email</span><span className="admin-mobile-card__value">{p.user.email}</span></div>
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Points</span><span className="admin-mobile-card__value">{p.points}</span></div>
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Role</span><span className="admin-mobile-card__value">{p.is_staff ? 'Staff' : 'Member'}</span></div>
              <div className="admin-actions-wrap">
                {!p.is_staff ? <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void promote(p)}>Promote</button> : null}
                <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void shadowBan(p)}>Toggle shadow-ban</button>
                {p.status === 'active' ? (
                  <button type="button" className="admin-btn admin-btn--danger" onClick={() => setModal({ profile: p, action: 'suspend' })}>Suspend</button>
                ) : (
                  <button type="button" className="admin-btn admin-btn--success" onClick={() => setModal({ profile: p, action: 'activate' })}>Activate</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <h3 style={{ marginTop: 0 }}>Confirm {modal.action}</h3>
            <p>@{modal.profile.user.username} — {modal.action}?</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setModal(null)}>Cancel</button>
              <button type="button" className="admin-btn admin-btn--primary" onClick={confirmStatusChange}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
