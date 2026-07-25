'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { deleteStoryAdmin, fetchStoriesAdmin } from '@/lib/adminApi';
import type { AdminStory } from '@/lib/adminTypes';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

export default function AdminForgePage() {
  const confirm = useConfirm();
  const [stories, setStories] = useState<AdminStory[]>([]);
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    fetchStoriesAdmin().then(setStories).catch(() => setMessage('Failed to load stories'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (story: AdminStory) => {
    if (!(await confirm(`Delete "${story.title}"?`, { danger: true, confirmLabel: 'Delete' }))) return;
    const res = await deleteStoryAdmin(story.id);
    if (res.ok) {
      setMessage('Story deleted.');
      load();
    } else {
      setMessage('Delete failed.');
    }
  };

  return (
    <AdminShell title="Forge Stories" subtitle="Review collaborative stories and remove inappropriate content">
      {message ? <div className="admin-alert admin-alert--success">{message}</div> : null}
      <div className="admin-panel">
        <div className="admin-table-wrap admin-table--desktop">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Segments</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stories.map((story) => (
                <tr key={story.id}>
                  <td>{story.title}</td>
                  <td>@{story.owner?.username || 'unknown'}</td>
                  <td>{story.status}</td>
                  <td>{story.segment_count}/{story.max_segments}</td>
                  <td>{new Date(story.updated_at).toLocaleString()}</td>
                  <td><button type="button" className="admin-btn admin-btn--danger" onClick={() => void remove(story)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-mobile-cards">
          {stories.map((story) => (
            <div key={story.id} className="admin-mobile-card">
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Title</span><span className="admin-mobile-card__value">{story.title}</span></div>
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Owner</span><span className="admin-mobile-card__value">@{story.owner?.username || 'unknown'}</span></div>
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Status</span><span className="admin-mobile-card__value">{story.status}</span></div>
              <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Segments</span><span className="admin-mobile-card__value">{story.segment_count}/{story.max_segments}</span></div>
              <div className="admin-actions-wrap"><button type="button" className="admin-btn admin-btn--danger" onClick={() => void remove(story)}>Delete</button></div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}