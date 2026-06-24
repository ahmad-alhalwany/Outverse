'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { deleteIdea, fetchIdeasAdmin, saveIdea } from '@/lib/adminApi';
import type { AdminIdea } from '@/lib/adminTypes';

const EMPTY = {
  title: '',
  description: '',
  category: 'other',
  status: 'proposed',
  cover_url: '',
};

export default function AdminBazaarPage() {
  const [ideas, setIdeas] = useState<AdminIdea[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    fetchIdeasAdmin().then(setIdeas).catch(() => setMsg('Failed to load ideas'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await saveIdea(form, editId ?? undefined);
    if (res.ok) {
      setMsg(editId ? 'Idea updated.' : 'Idea created.');
      setEditId(null);
      setForm(EMPTY);
      load();
    } else {
      setMsg('Save failed.');
    }
  };

  return (
    <AdminShell title="Bazaar (Ideas)" subtitle="Manage community ideas and proposals">
      {msg && <div className="admin-alert admin-alert--success">{msg}</div>}

      <div className="admin-grid-2">
        <div className="admin-panel">
          <h3 className="admin-panel__title">All ideas ({ideas.length})</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Votes</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ideas.map((idea) => (
                  <tr key={idea.id}>
                    <td>{idea.title}</td>
                    <td>{idea.category}</td>
                    <td>{idea.supporters}</td>
                    <td>{idea.status}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost"
                        onClick={() => {
                          setEditId(idea.id);
                          setForm({
                            title: idea.title,
                            description: idea.description,
                            category: idea.category,
                            status: idea.status,
                            cover_url: idea.cover_url || '',
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
                          if (!window.confirm('Delete idea?')) return;
                          await deleteIdea(idea.id);
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
        </div>

        <div className="admin-panel">
          <h3 className="admin-panel__title">{editId ? 'Edit idea' : 'New idea'}</h3>
          <form onSubmit={submit}>
            <div className="admin-form-row">
              <label>Title</label>
              <input className="admin-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="admin-form-row">
              <label>Description</label>
              <textarea className="admin-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            </div>
            <div className="admin-form-row">
              <label>Category</label>
              <select className="admin-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {['technology', 'design', 'writing', 'art', 'education', 'environment', 'health', 'social', 'other'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="admin-form-row">
              <label>Status</label>
              <select className="admin-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="proposed">proposed</option>
                <option value="in_progress">in_progress</option>
                <option value="completed">completed</option>
              </select>
            </div>
            <button type="submit" className="admin-btn admin-btn--primary">{editId ? 'Save' : 'Create'}</button>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}
