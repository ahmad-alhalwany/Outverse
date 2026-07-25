'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { fetchAdminDashboard } from '@/lib/adminApi';
import type { AdminDashboardData } from '@/lib/adminTypes';

const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false },
);
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false });
const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [range, setRange] = useState<'weekly' | 'monthly'>('weekly');

  useEffect(() => {
    fetchAdminDashboard().then(setData).catch(() => setData(null));
  }, []);

  return (
    <AdminShell title="Analytics Dashboard" subtitle="Weekly performance across the verse">
      {!data ? (
        <p style={{ color: 'var(--admin-muted)' }}>Loading…</p>
      ) : (
        <>
          <div className="admin-kpi-grid">
            <div className="admin-kpi admin-kpi--warm">
              <div className="admin-kpi__label">Challenge completion</div>
              <div className="admin-kpi__value">{data.completion_rate}%</div>
            </div>
            <div className="admin-kpi admin-kpi--warm">
              <div className="admin-kpi__label">Bottles caught</div>
              <div className="admin-kpi__value">{data.bottles_caught}</div>
            </div>
            <div className="admin-kpi admin-kpi--warm">
              <div className="admin-kpi__label">Social score</div>
              <div className="admin-kpi__value">{data.social_score}/10</div>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi__label">Achievements unlocked</div>
              <div className="admin-kpi__value">
                {data.achievements.unlocked}/{data.achievements.total_slots || '—'}
              </div>
            </div>
          </div>

          <div className="admin-panel admin-panel--light">
            <div className="admin-toolbar">
              <h3 className="admin-panel__title" style={{ margin: 0 }}>Creativity score</h3>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {(['weekly', 'monthly'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`admin-btn${range === r ? ' admin-btn--primary' : ' admin-btn--ghost'}`}
                    onClick={() => setRange(r)}
                  >
                    {r === 'weekly' ? 'Weekly' : 'Monthly'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.creativity_weeks}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ecd5cc" />
                  <XAxis dataKey="week" tick={{ fill: '#6d3d33', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#6d3d33', fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#c45c3e" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-panel admin-panel--light">
              <h3 className="admin-panel__title">Platform breakdown</h3>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Posts', v: data.counts.posts },
                      { name: 'Signals', v: data.counts.reels },
                      { name: 'Ideas', v: data.counts.ideas },
                      { name: 'Bottles', v: data.counts.bottles },
                      { name: 'Stories', v: data.counts.stories },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ecd5cc" />
                    <XAxis dataKey="name" tick={{ fill: '#6d3d33', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#6d3d33', fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="v" fill="#6d3d33" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="admin-panel admin-panel--light">
              <h3 className="admin-panel__title">Mood patterns</h3>
              <div className="admin-mood-grid">
                {data.mood_calendar.slice(-14).map((cell) => (
                  <div
                    key={cell.date}
                    className={`admin-mood-cell${cell.total > 2 ? ' admin-mood-cell--active' : ''}`}
                  >
                    <span>{cell.day}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.8rem', marginTop: '0.75rem' }}>
                Performing above average on{' '}
                <strong>{Math.round(data.completion_rate * 0.4)}%</strong> of tracked metrics
              </p>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
