'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { fetchAdminProfiles, patchProfile } from '@/lib/adminApi';
import type { AdminProfile } from '@/lib/adminTypes';

type Achievement = {
  title?: string;
  category?: string;
  completed?: boolean;
  progress?: number;
  goal?: number;
};

const CATEGORIES = ['Challenges', 'Ideas', 'Stories'] as const;

export default function AdminAchievementsPage() {
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [selected, setSelected] = useState<AdminProfile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    fetchAdminProfiles().then(setProfiles).catch(() => setMsg('Failed to load'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectUser = (p: AdminProfile) => {
    setSelected(p);
    setAchievements(Array.isArray(p.achievements) ? (p.achievements as Achievement[]) : []);
  };

  const addAchievement = () => {
    setAchievements((a) => [
      ...a,
      { title: 'New badge', category: 'Challenges', progress: 0, goal: 10, completed: false },
    ]);
  };

  const save = async () => {
    if (!selected) return;
    const res = await patchProfile(selected.id, { achievements: achievements as never });
    if (res.ok) {
      setMsg(`Achievements saved for @${selected.user.username}`);
      load();
    } else {
      setMsg('Save failed');
    }
  };

  const byCategory = (cat: string) =>
    achievements.filter((a) => (a.category || 'Challenges') === cat);

  const total = achievements.length;
  const unlocked = achievements.filter((a) => a.completed || (a.progress ?? 0) >= (a.goal ?? 1)).length;

  return (
    <AdminShell title="Achievements Gallery" subtitle="Manage traveler badges and progress">
      {msg && <div className="admin-alert admin-alert--success">{msg}</div>}

      <div className="admin-kpi-grid">
        <div className="admin-kpi admin-kpi--warm">
          <div className="admin-kpi__label">Total badges (selected)</div>
          <div className="admin-kpi__value">{total}</div>
        </div>
        <div className="admin-kpi admin-kpi--warm">
          <div className="admin-kpi__label">Unlocked</div>
          <div className="admin-kpi__value">{unlocked}</div>
        </div>
        <div className="admin-kpi admin-kpi--warm">
          <div className="admin-kpi__label">Remaining</div>
          <div className="admin-kpi__value">{Math.max(0, total - unlocked)}</div>
        </div>
      </div>

      <div className="admin-grid-2">
        <div className="admin-panel">
          <h3 className="admin-panel__title">Select traveler</h3>
          <div className="admin-table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Badges</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr
                    key={p.id}
                    style={{ cursor: 'pointer', background: selected?.id === p.id ? 'rgba(106,0,255,0.2)' : undefined }}
                    onClick={() => selectUser(p)}
                  >
                    <td>@{p.user.username}</td>
                    <td>{Array.isArray(p.achievements) ? p.achievements.length : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-panel admin-panel--light">
          {selected ? (
            <>
              <div className="admin-toolbar">
                <h3 className="admin-panel__title" style={{ margin: 0 }}>@{selected.user.username}</h3>
                <button type="button" className="admin-btn admin-btn--primary" onClick={addAchievement}>+ Badge</button>
              </div>
              {CATEGORIES.map((cat) => (
                <div key={cat} style={{ marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>{cat}</h4>
                  <div className="admin-achievement-grid">
                    {byCategory(cat).map((a, idx) => {
                      const goal = a.goal ?? 10;
                      const prog = a.progress ?? 0;
                      const pct = Math.min(100, Math.round((prog / goal) * 100));
                      return (
                        <div key={`${cat}-${idx}`} className="admin-achievement-card">
                          <input
                            className="admin-input admin-input--light"
                            value={a.title || ''}
                            onChange={(e) => {
                              const next = [...achievements];
                              const globalIdx = achievements.indexOf(a);
                              next[globalIdx] = { ...a, title: e.target.value };
                              setAchievements(next);
                            }}
                          />
                          <div className="admin-achievement-card__bar">
                            <div className="admin-achievement-card__fill" style={{ width: `${pct}%` }} />
                          </div>
                          <div style={{ fontSize: '0.75rem' }}>
                            <input
                              type="number"
                              style={{ width: 48 }}
                              value={prog}
                              onChange={(e) => {
                                const next = [...achievements];
                                const globalIdx = achievements.indexOf(a);
                                next[globalIdx] = { ...a, progress: Number(e.target.value) };
                                setAchievements(next);
                              }}
                            />
                            /{goal}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button type="button" className="admin-btn admin-btn--primary" onClick={save}>Save achievements</button>
            </>
          ) : (
            <p style={{ color: 'var(--admin-brown)', opacity: 0.7 }}>Select a user to edit achievements</p>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
