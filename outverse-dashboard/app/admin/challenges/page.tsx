"use client";
import { useEffect, useState } from "react";

interface Challenge {
  id: number;
  title: string;
  type: string;
  difficulty: string;
  created_at: string;
}

import { apiUrl } from '@/lib/api';

const API_URL = apiUrl('challenges/');

export default function ChallengesAdminPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(API_URL)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch challenges");
        return res.json();
      })
      .then((data) => setChallenges(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Challenges Management</h1>
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>All Challenges</h2>
        {loading ? (
          <div style={{ color: "#FFB300", margin: "24px 0" }}>Loading...</div>
        ) : error ? (
          <div style={{ color: "#FF3B3B", margin: "24px 0" }}>{error}</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
            <thead>
              <tr style={{ background: "#23234A" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Title</th>
                <th style={{ textAlign: "left", padding: 8 }}>Type</th>
                <th style={{ textAlign: "left", padding: 8 }}>Difficulty</th>
                <th style={{ textAlign: "left", padding: 8 }}>Created At</th>
              </tr>
            </thead>
            <tbody>
              {challenges.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 24, color: "#888" }}>
                    No challenges found.
                  </td>
                </tr>
              ) : (
                challenges.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #2E2E4D" }}>
                    <td style={{ padding: 8 }}>{item.title}</td>
                    <td style={{ padding: 8 }}>{item.type}</td>
                    <td style={{ padding: 8 }}>{item.difficulty}</td>
                    <td style={{ padding: 8 }}>{new Date(item.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
} 