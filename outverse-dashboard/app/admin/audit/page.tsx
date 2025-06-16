'use client';
import { useEffect, useState } from "react";
import { format } from "date-fns";
import "../../globals.css";

interface AuditLog {
  id: number;
  user_email: string;
  action: string;
  action_display: string;
  description: string;
  ip_address: string;
  created_at: string;
  metadata: any;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("http://localhost:8000/api/audit/logs/")
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch audit logs');
        return res.json();
      })
      .then(data => setLogs(Array.isArray(data.results) ? data.results : []))
      .catch(err => {
        setError(err.message);
        setLogs([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Audit Logs</h1>
      <div className="card" style={{ padding: 24 }}>
        {loading ? (
          <div style={{ color: '#FFB300', margin: '24px 0' }}>Loading...</div>
        ) : error ? (
          <div style={{ color: '#FF3B3B', margin: '24px 0' }}>{error}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2A2D3E' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Time</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>User</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Action</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Description</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(logs) && logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #2A2D3E' }}>
                      <td style={{ padding: '12px' }}>
                        {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                      </td>
                      <td style={{ padding: '12px' }}>{log.user_email}</td>
                      <td style={{ padding: '12px' }}>{log.action_display}</td>
                      <td style={{ padding: '12px' }}>{log.description}</td>
                      <td style={{ padding: '12px' }}>{log.ip_address}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#aaa', padding: 24 }}>
                      No audit logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 