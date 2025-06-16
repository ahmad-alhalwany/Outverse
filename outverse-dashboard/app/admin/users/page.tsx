'use client';
import { useEffect, useState } from "react";
import "../../globals.css";

interface UserProfile {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
  };
  points: number;
  mood_history: any[];
  achievements: any[];
  status: 'active' | 'suspended';
}

export default function UserManagement() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ open: boolean; profile?: UserProfile; action?: 'suspend' | 'activate' }>({ open: false });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/users/profiles/");
      const data = await res.json();
      setProfiles(data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to fetch users.' });
    }
  };

  const filtered = profiles.filter(profile =>
    profile.user.username.toLowerCase().includes(search.toLowerCase()) ||
    profile.user.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAction = (profile: UserProfile, action: 'suspend' | 'activate') => {
    setModal({ open: true, profile, action });
  };

  const confirmAction = async () => {
    if (!modal.profile || !modal.action) return;
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/users/profiles/${modal.profile.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: modal.action === 'suspend' ? 'suspended' : 'active' }),
      });
      if (!res.ok) throw new Error('Failed to update user status');
      setMessage({ type: 'success', text: `User ${modal.profile.user.username} ${modal.action === 'suspend' ? 'suspended' : 'activated'} successfully.` });
      // تحديث الحالة محليًا
      setProfiles(prev =>
        prev.map(p =>
          p.id === modal.profile!.id
            ? { ...p, status: modal.action === 'suspend' ? 'suspended' : 'active' }
            : p
        )
      );
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update user status.' });
    } finally {
      setLoading(false);
      setModal({ open: false });
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>User Management</h1>
      {message && (
        <div className="alert" style={{ marginBottom: 18, color: message.type === 'success' ? '#4caf50' : '#FF3B3B' }}>
          {message.text}
          <button onClick={() => setMessage(null)} style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', fontWeight: 700, cursor: 'pointer' }}>×</button>
        </div>
      )}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: 6, borderRadius: 6, border: '1px solid #2E2E4D', background: '#23234A', color: '#F5F6FA', width: 200 }}
          />
          <button className="danger" style={{ fontWeight: 600, borderRadius: 6, padding: '4px 16px', cursor: 'pointer' }}>Ban Selected</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
          <thead>
            <tr style={{ background: '#23234A' }}>
              <th style={{ textAlign: 'left', padding: 8 }}>Name</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Email</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Points</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(profile => (
              <tr key={profile.id} style={{ borderBottom: '1px solid #2E2E4D' }}>
                <td style={{ padding: 8 }}>{profile.user.username}</td>
                <td style={{ padding: 8 }}>{profile.user.email}</td>
                <td style={{ padding: 8 }}>{profile.points}</td>
                <td style={{ padding: 8 }}>
                  <span style={{
                    background: profile.status === 'active' ? '#222' : '#FF3B3B',
                    color: profile.status === 'active' ? '#F5F6FA' : '#fff',
                    borderRadius: 8,
                    padding: '2px 12px',
                    fontWeight: 600,
                    fontSize: 13,
                  }}>
                    {profile.status === 'active' ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td style={{ padding: 8 }}>
                  {profile.status === 'active' ? (
                    <button
                      className="danger"
                      style={{ borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}
                      onClick={() => handleAction(profile, 'suspend')}
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      style={{ background: '#4caf50', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}
                      onClick={() => handleAction(profile, 'activate')}
                    >
                      Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#23234A', color: '#F5F6FA', borderRadius: 12, padding: 32, minWidth: 320, boxShadow: '0 2px 16px #1118' }}>
            <h2 style={{ color: modal.action === 'suspend' ? '#FF3B3B' : '#4caf50', marginBottom: 18 }}>
              {modal.action === 'suspend' ? 'Confirm Suspension' : 'Confirm Activation'}
            </h2>
            <p style={{ marginBottom: 24 }}>
              Are you sure you want to <b style={{ color: modal.action === 'suspend' ? '#FF3B3B' : '#4caf50' }}>{modal.action}</b> user <b>{modal.profile?.user.username}</b>?
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setModal({ open: false })}
                style={{ background: 'none', color: '#F5F6FA', border: '1px solid #888', borderRadius: 6, padding: '6px 18px', cursor: 'pointer' }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className={modal.action === 'suspend' ? 'danger' : ''}
                style={{
                  background: modal.action === 'suspend' ? '#2E1A1A' : '#4caf50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 18px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
                disabled={loading}
              >
                {loading ? 'Processing...' : modal.action === 'suspend' ? 'Suspend' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 