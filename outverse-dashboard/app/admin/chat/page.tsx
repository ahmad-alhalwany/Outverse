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
    <AdminShell title="Cosmic Chat">
      <div className="card" style={{ padding: 24 }}>
        <p style={{ color: '#aaa', marginBottom: 16 }}>
          Django admin: <code>/admin/</code> — full CRUD on conversations, messages, and rooms.
        </p>
        {error && <p style={{ color: '#FF3B3B' }}>{error}</p>}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
            {(
              [
                ['Conversations', stats.conversations],
                ['DM messages', stats.messages],
                ['Group rooms', stats.rooms],
                ['Room messages', stats.room_messages],
                ['Presence', stats.presence_records],
              ] as const
            ).map(([label, value]) => (
              <div key={label} style={{ background: '#23234A', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, color: '#aaa' }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
