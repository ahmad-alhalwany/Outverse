'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { fetchAdminDashboard } from '@/lib/adminApi';
import type { AdminDashboardData } from '@/lib/adminTypes';

const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false },
);
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });

function Kpi({
  label,
  value,
  delta,
  warm,
}: {
  label: string;
  value: string | number;
  delta?: string;
  warm?: boolean;
}) {
  return (
    <div className={`admin-kpi${warm ? ' admin-kpi--warm' : ''}`}>
      <div className="admin-kpi__label">{label}</div>
      <div className="admin-kpi__value">{value}</div>
      {delta && (
        <div className={`admin-kpi__delta${delta.startsWith('+') ? ' admin-kpi__delta--up' : ''}`}>
          {delta}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    fetchAdminDashboard()
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e: Error) => setError(e.message === 'STAFF_REQUIRED' ? 'Staff token required.' : e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminShell
      title="Command Center"
      subtitle="Platform overview — live data from Django"
      actions={
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={load}
        >
          ↻ Refresh
        </button>
      }
    >
      {error && <div className="admin-alert admin-alert--error">{error}</div>}

      {!data ? (
        <p style={{ color: 'var(--admin-muted)' }}>Loading dashboard…</p>
      ) : (
        <>
          <div className="admin-kpi-grid">
            <Kpi label="Active users" value={data.counts.active_users} delta={`${data.counts.users} total`} warm />
            <Kpi
              label="Pending reports"
              value={data.counts.pending_flags}
              delta={data.counts.pending_flags > 0 ? 'Needs review' : 'All clear'}
            />
            <Kpi label="Today's orders" value={data.shop.orders_today} delta={`${data.shop.revenue_today} Nova`} warm />
            <Kpi label="Completion rate" value={`${data.completion_rate}%`} delta="Lab challenges" warm />
            <Kpi label="Signals (reels)" value={data.counts.reels} />
            <Kpi label="Shop products" value={data.shop.active_products} delta={`${data.shop.featured_products} featured`} />
          </div>

          <div className="admin-grid-2">
            <div className="admin-panel admin-panel--light">
              <h3 className="admin-panel__title">Weekly activity</h3>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.weekly_activity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ecd5cc" />
                    <XAxis dataKey="day" tick={{ fill: '#6d3d33', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#6d3d33', fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="total" stroke="#6d3d33" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="admin-panel admin-panel--light">
              <h3 className="admin-panel__title">Mood heatmap (28 days)</h3>
              <div className="admin-mood-grid">
                {data.mood_calendar.map((cell) => (
                  <div
                    key={cell.date}
                    className={`admin-mood-cell${cell.total > 0 ? ' admin-mood-cell--active' : ''}`}
                    title={`${cell.date}: ${cell.dominant}`}
                  >
                    <span>{cell.day}</span>
                    <span>{cell.total > 0 ? '🙂' : '·'}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.75rem', marginTop: '0.75rem', opacity: 0.8 }}>
                {data.mood_calendar.filter((c) => c.total > 0).length} active mood days logged
              </p>
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-panel">
              <div className="admin-toolbar">
                <h3 className="admin-panel__title" style={{ margin: 0 }}>Recent reports</h3>
                <Link href="/admin/moderation" className="admin-btn admin-btn--ghost">
                  View all
                </Link>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Content</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_flags.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ color: 'var(--admin-muted)' }}>No reports yet</td>
                      </tr>
                    ) : (
                      data.recent_flags.map((f) => (
                        <tr key={f.id}>
                          <td>{f.type}</td>
                          <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.content}
                          </td>
                          <td>
                            <span className={`admin-badge admin-badge--${f.status}`}>{f.status}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="admin-panel">
              <h3 className="admin-panel__title">Top supporters</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {data.top_supporters.map((s) => (
                  <li
                    key={s.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0',
                      borderBottom: '1px solid var(--admin-border)',
                    }}
                  >
                    <span>@{s.user__username}</span>
                    <strong>{s.points} pts</strong>
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link href="/admin/users" className="admin-btn admin-btn--primary">Users</Link>
                <Link href="/admin/shop" className="admin-btn admin-btn--ghost">Shop</Link>
                <Link href="/admin/reels" className="admin-btn admin-btn--ghost">Signals</Link>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
