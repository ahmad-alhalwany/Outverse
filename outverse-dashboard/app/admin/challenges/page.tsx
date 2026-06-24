'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { deleteChallenge, fetchChallengesAdmin, saveChallenge } from '@/lib/adminApi';
import type { AdminChallenge } from '@/lib/adminTypes';

const EMPTY = {
  title: '',
  description: '',
  type: 'writing',
  difficulty: 'medium',
  is_daily: false,
  is_active: true,
  end_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
};

export default function AdminChallengesPage() {
  const [challenges, setChallenges] = useState<AdminChallenge[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    fetchChallengesAdmin().then(setChallenges).catch(() => setMsg('Failed to load challenges'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      end_date: new Date(form.end_date).toISOString(),
    };
    const res = await saveChallenge(payload, editId ?? undefined);
    if (res.ok) {
      setMsg(editId ? 'Challenge updated.' : 'Challenge created.');
      setEditId(null);
      setForm(EMPTY);
      load();
    } else {
      setMsg('Save failed.');
    }
  };

  return (
    <AdminShell
      title="Lab Challenges"
      subtitle="Create daily challenges and manage the archive"
      actions={
        <button type="button" className="admin-btn admin-btn--primary" onClick={() => { setEditId(null); setForm(EMPTY); }}>
          + New challenge
        </button>
      }
    >
      {msg && <div className="admin-alert admin-alert--success">{msg}</div>}

      <div className="admin-grid-2">
        <div className="admin-panel">
          <h3 className="admin-panel__title">All challenges ({challenges.length})</h3>
          <div className="admin-table-wrap admin-table--desktop">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Daily</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {challenges.map((c) => (
                  <tr key={c.id}>
                    <td>{c.title}</td>
                    <td>{c.type}</td>
                    <td>{c.is_daily ? '✓' : '—'}</td>
                    <td>{c.is_active ? '✓' : '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost"
                        onClick={() => {
                          setEditId(c.id);
                          setForm({
                            title: c.title,
                            description: c.description || '',
                            type: c.type,
                            difficulty: c.difficulty,
                            is_daily: c.is_daily,
                            is_active: c.is_active,
                            end_date: c.end_date.slice(0, 16),
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--danger"
                        style={{ marginLeft: 6 }}
                        onClick={async () => {
                          if (!window.confirm('Delete challenge?')) return;
                          await deleteChallenge(c.id);
                          load();
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
          <div className="admin-mobile-cards">
            {challenges.map((c) => (
              <div key={c.id} className="admin-mobile-card">
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Title</span><span className="admin-mobile-card__value">{c.title}</span></div>
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Type</span><span className="admin-mobile-card__value">{c.type}</span></div>
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Daily</span><span className="admin-mobile-card__value">{c.is_daily ? 'Yes' : 'No'}</span></div>
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Active</span><span className="admin-mobile-card__value">{c.is_active ? 'Yes' : 'No'}</span></div>
                <div className="admin-actions-wrap">
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => {
                    setEditId(c.id);
                    setForm({ title: c.title, description: c.description || '', type: c.type, difficulty: c.difficulty, is_daily: c.is_daily, is_active: c.is_active, end_date: c.end_date.slice(0, 16) });
                  }}>Edit</button>
                  <button type="button" className="admin-btn admin-btn--danger" onClick={async () => { if (!window.confirm('Delete challenge?')) return; await deleteChallenge(c.id); load(); }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-panel">
          <h3 className="admin-panel__title">{editId ? 'Edit challenge' : 'Create challenge'}</h3>
          <form onSubmit={submit}>
            <div className="admin-form-row">
              <label>Title</label>
              <input className="admin-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="admin-form-row">
              <label>Description</label>
              <textarea className="admin-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="admin-form-row">
              <label>Type</label>
              <select className="admin-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {['writing', 'art', 'music', 'experimental', 'practical'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="admin-form-row">
              <label>End date</label>
              <input className="admin-input" type="datetime-local" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
            </div>
            <label style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: '0.85rem' }}>
              <input type="checkbox" checked={form.is_daily} onChange={(e) => setForm({ ...form, is_daily: e.target.checked })} />
              Daily challenge
            </label>
            <label style={{ display: 'flex', gap: 8, marginBottom: 12, fontSize: '0.85rem' }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
            <button type="submit" className="admin-btn admin-btn--primary">{editId ? 'Save' : 'Create'}</button>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}
