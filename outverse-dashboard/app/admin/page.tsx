'use client'

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "../globals.css";

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
}

export default function AdminDashboard() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/users/profiles/")
      .then(res => res.json())
      .then(data => setProfiles(data));
  }, []);

  const navLinks = [
    { href: "/admin", label: "Dashboard", icon: "🏠" },
    { href: "/admin/users", label: "User Management", icon: "👥" },
    { href: "/admin/moderation", label: "Content Moderation", icon: "🚩" },
    { href: "/admin/challenges", label: "Challenges", icon: "🎯" },
    { href: "/admin/analytics", label: "Analytics", icon: "📊" },
    { href: "/admin/health", label: "System Health", icon: "💻" },
    { href: "/admin/audit", label: "Audit Logs", icon: "📜" },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside className="sidebar" style={{ width: sidebarOpen ? 220 : 64, transition: 'width 0.2s', borderRight: '1px solid #23234A', padding: sidebarOpen ? 24 : 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
          <h2 style={{ fontWeight: 700, fontSize: 24, flex: 1, transition: 'opacity 0.2s', opacity: sidebarOpen ? 1 : 0 }}>Outverse</h2>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: '#F5F6FA', fontSize: 22, cursor: 'pointer' }} title="Toggle sidebar">{sidebarOpen ? '⏪' : '⏩'}</button>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                color: pathname === link.href ? '#FF3B3B' : '#F5F6FA',
                textDecoration: 'none',
                fontWeight: pathname === link.href ? 700 : 500,
                display: 'flex', alignItems: 'center', gap: 10,
                background: pathname === link.href ? '#23234A' : 'none',
                borderRadius: 8,
                padding: sidebarOpen ? '6px 12px' : '6px',
                transition: 'all 0.15s',
              }}
            >
              <span>{link.icon}</span>{sidebarOpen && link.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: 32 }}>
        {/* Security Alert */}
        <div className="alert" style={{ marginBottom: 24 }}>
          <b>Security Alert:</b> Unusual login activity detected <button className="danger" style={{ float: 'right', fontWeight: 600, borderRadius: 6, padding: '4px 16px', cursor: 'pointer' }}>View Details</button>
        </div>
        {/* Cards */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
          <div className="card" style={{ flex: 1, padding: 24 }}>
            <div style={{ fontSize: 14, color: '#aaa' }}>Active Users</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{profiles.length}</div>
            <div style={{ fontSize: 12, color: '#4caf50' }}>+12.5% from last week</div>
          </div>
          <div className="card" style={{ flex: 1, padding: 24 }}>
            <div style={{ fontSize: 14, color: '#aaa' }}>Flagged Content</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>24</div>
            <div style={{ fontSize: 12, color: '#FF3B3B' }}>4 high priority</div>
          </div>
          <div className="card" style={{ flex: 1, padding: 24 }}>
            <div style={{ fontSize: 14, color: '#aaa' }}>System Health</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>98.2%</div>
            <div style={{ fontSize: 12, color: '#F5F6FA' }}>Stable</div>
          </div>
          <div className="card" style={{ flex: 1, padding: 24 }}>
            <div style={{ fontSize: 14, color: '#aaa' }}>Security Status</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>A+</div>
            <div style={{ fontSize: 12, color: '#F5F6FA' }}>2FA Enabled</div>
          </div>
        </div>

        {/* User Management Table */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>User Management</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <input type="text" placeholder="Search users..." style={{ padding: 6, borderRadius: 6, border: '1px solid #2E2E4D', background: '#23234A', color: '#F5F6FA', width: 200 }} />
            <button className="danger" style={{ fontWeight: 600, borderRadius: 6, padding: '4px 16px', cursor: 'pointer' }}>Ban Selected</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr style={{ background: '#23234A' }}>
                <th style={{ textAlign: 'left', padding: 8 }}>Name</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Email</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Points</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(profile => (
                <tr key={profile.id} style={{ borderBottom: '1px solid #2E2E4D' }}>
                  <td style={{ padding: 8 }}>{profile.user.username}</td>
                  <td style={{ padding: 8 }}>{profile.user.email}</td>
                  <td style={{ padding: 8 }}>{profile.points}</td>
                  <td style={{ padding: 8 }}>
                    <button className="danger" style={{ borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
                      Ban
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
} 