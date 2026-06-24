'use client';

import { useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { broadcastNotification } from '@/lib/adminApi';

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [userIds, setUserIds] = useState('');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

  const parsedUserIds = useMemo(
    () => userIds.split(',').map((value) => Number(value.trim())).filter((value) => Number.isFinite(value) && value > 0),
    [userIds],
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setStatus('');
    const res = await broadcastNotification({
      title: title.trim(),
      message: message.trim(),
      user_ids: parsedUserIds.length ? parsedUserIds : undefined,
    });
    if (res.ok) {
      const data = await res.json();
      setStatus(`Broadcast sent to ${data.sent} users.`);
      setTitle('');
      setMessage('');
      setUserIds('');
    } else {
      setStatus('Broadcast failed.');
    }
    setSending(false);
  };

  return (
    <AdminShell title="Broadcast Notifications" subtitle="Send platform-wide or targeted staff announcements">
      {status ? <div className="admin-alert admin-alert--success">{status}</div> : null}
      <div className="admin-panel">
        <form onSubmit={submit}>
          <div className="admin-form-row">
            <label>Title</label>
            <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="admin-form-row">
            <label>Message</label>
            <textarea className="admin-input" value={message} onChange={(e) => setMessage(e.target.value)} required />
          </div>
          <div className="admin-form-row">
            <label>User IDs (optional, comma separated)</label>
            <input className="admin-input" value={userIds} onChange={(e) => setUserIds(e.target.value)} placeholder="Leave blank to send to everyone" />
          </div>
          <button type="submit" className="admin-btn admin-btn--primary" disabled={sending}>
            {sending ? 'Sending…' : 'Send broadcast'}
          </button>
        </form>
      </div>
    </AdminShell>
  );
}