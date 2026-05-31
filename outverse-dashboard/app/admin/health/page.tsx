'use client';

import { useEffect, useState } from "react";
import { apiUrl } from '@/lib/api';

interface Service {
  name: string;
  status: string;
  color: string;
  lastCheck: string;
}

export default function SystemHealthPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(apiUrl('health/system/'))
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch system health');
        return res.json();
      })
      .then(data => setServices(Array.isArray(data.services) ? data.services : []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>System Health</h1>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {loading ? (
          <div style={{ color: '#FFB300', margin: '24px 0' }}>Loading...</div>
        ) : error ? (
          <div style={{ color: '#FF3B3B', margin: '24px 0' }}>{error}</div>
        ) : services.length === 0 ? (
          <div style={{ color: '#aaa', margin: '24px 0' }}>No services found.</div>
        ) : (
          services.map(service => (
            <div key={service.name} className="card" style={{ flex: '1 1 220px', minWidth: 220, padding: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', borderLeft: `6px solid ${service.color}` }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{service.name}</div>
              <div style={{ fontSize: 15, marginBottom: 8 }}>
                Status: <span style={{ color: service.color, fontWeight: 700 }}>{service.status.charAt(0).toUpperCase() + service.status.slice(1)}</span>
              </div>
              <div style={{ fontSize: 13, color: '#aaa' }}>Last check: {service.lastCheck}</div>
            </div>
          ))
        )}
      </div>
      <div className="card" style={{ padding: 24, marginTop: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>System Status</h2>
        <ul style={{ color: '#F5F6FA', fontSize: 15, margin: 0, padding: 0, listStyle: 'none' }}>
          {services.map(service => (
            <li key={service.name} style={{ marginBottom: 8 }}>
              <span style={{ color: service.color, fontWeight: 700 }}>{service.name}</span>: {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 