'use client';
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("http://localhost:8000/api/analytics/platform/")
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch analytics');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Analytics</h1>
      <div className="card" style={{ padding: 24, marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Platform Analytics</h2>
        {loading ? (
          <div style={{ color: '#FFB300', margin: '24px 0' }}>Loading...</div>
        ) : error ? (
          <div style={{ color: '#FF3B3B', margin: '24px 0' }}>{error}</div>
        ) : data ? (
          <ul style={{ fontSize: 17, color: '#F5F6FA', lineHeight: 2 }}>
            <li>Users: <b>{data.users}</b></li>
            <li>Challenges: <b>{data.challenges}</b></li>
            <li>Ideas: <b>{data.ideas}</b></li>
            <li>Moods: <b>{data.moods}</b></li>
            <li>Bottles: <b>{data.bottles}</b></li>
            <li>Stories: <b>{data.stories}</b></li>
            <li>Shop Items: <b>{data.shop_items}</b></li>
          </ul>
        ) : null}
      </div>
    </div>
  );
} 