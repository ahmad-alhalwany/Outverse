'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { apiFetch } from '@/lib/api';

type Overview = {
  conversations: number;
  messages: number;
  rooms: number;
  room_messages: number;
  presence_records: number;
};

export default function AdminChatPage() {
  const [stats, setStats] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('chat/admin/overview/')
      .then((res) => {
        if (res.status === 403) {
          throw new Error('Admin login required (Django staff user + token).');
        }
        if (!res.ok) throw new Error('Failed to load chat stats');
        return res.json();
      })
      .then(setStats)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <AdminShell title="Cosmic Chat" subtitle="DMs, rooms, and presence overview">
      {error && <div className="admin-alert admin-alert--error">{error}</div>}
      {stats && (
        <div className="admin-kpi-grid">
          {(
            [
              ['Conversations', stats.conversations],
              ['DM messages', stats.messages],
              ['Group rooms', stats.rooms],
              ['Room messages', stats.room_messages],
              ['Presence', stats.presence_records],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="admin-kpi">
              <div className="admin-kpi__label">{label}</div>
              <div className="admin-kpi__value">{value}</div>
            </div>
          ))}
        </div>
      )}
      <div className="admin-panel">
        <p style={{ color: 'var(--admin-muted)', fontSize: '0.85rem', margin: 0 }}>
          Message moderation and stats are shown here. To edit or delete individual chat
          messages, use{' '}
          <a
            href="http://127.0.0.1:8000/admin/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-vault hover:underline"
          >
            Django admin
          </a>
          .
        </p>
      </div>
    </AdminShell>
  );
}
