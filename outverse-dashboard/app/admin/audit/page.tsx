'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import AdminShell from '@/components/admin/AdminShell';
import { apiFetch } from '@/lib/api';

interface AuditLog {
  id: number;
  user_email: string;
  action: string;
  action_display: string;
  description: string;
  ip_address: string;
  created_at: string;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('audit/logs/')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch audit logs');
        return res.json();
      })
      .then((data) => setLogs(Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : []))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <AdminShell title="Audit Logs" subtitle="Security and activity trail">
      {error && <div className="admin-alert admin-alert--error">{error}</div>}
      <div className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Description</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--admin-muted)' }}>No audit logs yet</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>{format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}</td>
                    <td>{log.user_email}</td>
                    <td>{log.action_display || log.action}</td>
                    <td>{log.description}</td>
                    <td>{log.ip_address}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
