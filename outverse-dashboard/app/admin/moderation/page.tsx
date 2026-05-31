'use client';
import { useState, useEffect } from "react";
import "../../globals.css";

interface FlaggedContent {
  id: number;
  type: 'post' | 'comment';
  content: string;
  reporter: string;
  status: 'pending' | 'approved' | 'rejected';
}

import { apiUrl } from '@/lib/api';

const API_URL = apiUrl('moderation/flagged/');

export default function ModerationPage() {
  const [flagged, setFlagged] = useState<FlaggedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; id?: number; action?: 'approve' | 'reject' }>({ open: false });
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch flagged content from API
  useEffect(() => {
    setLoading(true);
    fetch(API_URL)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch flagged content');
        return res.json();
      })
      .then(data => setFlagged(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAction = (id: number, action: 'approve' | 'reject') => {
    setModal({ open: true, id, action });
  };

  const confirmAction = async () => {
    if (!modal.id || !modal.action) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}${modal.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: modal.action === 'approve' ? 'approved' : 'rejected' }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      const updated = await res.json();
      setFlagged(prev => prev.map(item => item.id === updated.id ? updated : item));
      setModal({ open: false });
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Content Moderation</h1>
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Flagged Content</h2>
        {loading ? (
          <div style={{ color: '#FFB300', margin: '24px 0' }}>Loading...</div>
        ) : error ? (
          <div style={{ color: '#FF3B3B', margin: '24px 0' }}>{error}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr style={{ background: '#23234A' }}>
                <th style={{ textAlign: 'left', padding: 8 }}>Type</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Content</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Reporter</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flagged.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#888' }}>No flagged content found.</td></tr>
              ) : (
                flagged.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #2E2E4D' }}>
                    <td style={{ padding: 8 }}>{item.type === 'post' ? 'Post' : 'Comment'}</td>
                    <td style={{ padding: 8 }}>{item.content}</td>
                    <td style={{ padding: 8 }}>{item.reporter}</td>
                    <td style={{ padding: 8 }}>
                      <span style={{
                        background: item.status === 'pending' ? '#FFB300' : item.status === 'approved' ? '#4caf50' : '#FF3B3B',
                        color: '#fff',
                        borderRadius: 8,
                        padding: '2px 12px',
                        fontWeight: 600,
                        fontSize: 13,
                      }}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: 8 }}>
                      {item.status === 'pending' && (
                        <>
                          <button
                            style={{ background: '#4caf50', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', marginRight: 8 }}
                            onClick={() => handleAction(item.id, 'approve')}
                          >
                            Approve
                          </button>
                          <button
                            className="danger"
                            style={{ borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}
                            onClick={() => handleAction(item.id, 'reject')}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#23234A', color: '#F5F6FA', borderRadius: 12, padding: 32, minWidth: 320, boxShadow: '0 2px 16px #1118' }}>
            <h2 style={{ color: modal.action === 'reject' ? '#FF3B3B' : '#4caf50', marginBottom: 18 }}>
              {modal.action === 'reject' ? 'Confirm Rejection' : 'Confirm Approval'}
            </h2>
            <p style={{ marginBottom: 24 }}>
              Are you sure you want to <b style={{ color: modal.action === 'reject' ? '#FF3B3B' : '#4caf50' }}>{modal.action}</b> this content?
            </p>
            {error && <div style={{ color: '#FF3B3B', marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setModal({ open: false })}
                style={{ background: 'none', color: '#F5F6FA', border: '1px solid #888', borderRadius: 6, padding: '6px 18px', cursor: 'pointer' }}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className={modal.action === 'reject' ? 'danger' : ''}
                style={{
                  background: modal.action === 'reject' ? '#2E1A1A' : '#4caf50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 18px',
                  fontWeight: 600,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  opacity: actionLoading ? 0.7 : 1,
                }}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : modal.action === 'reject' ? 'Reject' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 