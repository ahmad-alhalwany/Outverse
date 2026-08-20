'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { apiFetch } from '@/lib/api';

interface Service {
  name: string;
  status: string;
  color: string;
  lastCheck: string;
}

export default function AdminHealthPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('health/system/')
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok && !data) throw new Error('Health check failed');
        return data;
      })
      .then((data) => {
        // Backend returns {checks: [{name, status, detail?}]}, not {services}.
        const checks = Array.isArray(data?.checks) ? data.checks : [];
        const now = new Date().toLocaleTimeString();
        setServices(
          checks.map((c: { name: string; status: string; detail?: string }) => ({
            name: c.name,
            status: c.status === 'ok' ? 'healthy' : c.status,
            color: c.status === 'ok' ? '#22c55e' : '#ef4444',
            lastCheck: now,
          })),
        );
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const healthy = services.filter((s) => s.status === 'healthy' || s.status === 'ok').length;
  const pct = services.length ? Math.round((healthy / services.length) * 100) : 0;

  return (
    <AdminShell title="System Health" subtitle="Service status across the platform">
      {error && <div className="admin-alert admin-alert--error">{error}</div>}
      <div className="admin-kpi-grid">
        <div className="admin-kpi">
          <div className="admin-kpi__label">Health score</div>
          <div className="admin-kpi__value">{pct}%</div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi__label">Services</div>
          <div className="admin-kpi__value">{services.length}</div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi__label">Healthy</div>
          <div className="admin-kpi__value">{healthy}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {services.map((service) => (
          <div
            key={service.name}
            className="admin-panel"
            style={{ flex: '1 1 220px', borderLeft: `4px solid ${service.color}` }}
          >
            <strong>{service.name}</strong>
            <p style={{ margin: '0.5rem 0', color: service.color, fontWeight: 700 }}>{service.status}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--admin-muted)' }}>Last check: {service.lastCheck}</p>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
