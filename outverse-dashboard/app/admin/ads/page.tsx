'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  fetchAdCreativesAdmin,
  approveAdCreative,
  rejectAdCreative,
  type AdminAdCreative,
} from '@/lib/adminApi';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

const FORMAT_LABEL: Record<string, string> = {
  image: 'Image',
  carousel: 'Carousel',
  video: 'Video',
  story: 'Story',
  reel: 'Reel',
};

const STATUS_FILTERS = ['pending_review', 'approved', 'rejected', 'draft'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default function AdminAdsPage() {
  const confirm = useConfirm();
  const [creatives, setCreatives] = useState<AdminAdCreative[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('pending_review');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(
    (status: StatusFilter) => {
      fetchAdCreativesAdmin(status)
        .then((data) => {
          setCreatives(data);
          setError('');
        })
        .catch((e: Error) => setError(e.message));
    },
    [],
  );

  useEffect(() => {
    load(filter);
  }, [load, filter]);

  const act = async (id: number, action: 'approve' | 'reject') => {
    if (!(await confirm(
      action === 'approve' ? 'Approve this ad creative?' : 'Reject this ad creative?',
      { danger: action === 'reject', confirmLabel: action === 'approve' ? 'Approve' : 'Reject' },
    ))) return;
    setBusy(id);
    setError('');
    try {
      const fn = action === 'approve' ? approveAdCreative : rejectAdCreative;
      const res = await fn(id);
      if (res.ok) load(filter);
      else {
        const data = await res.json().catch(() => null);
        setError(data?.detail || data?.error || 'Action failed');
      }
    } catch {
      setError('Action failed');
    } finally {
      setBusy(null);
    }
  };

  const pending = creatives.filter((c) => c.status === 'pending_review').length;

  const advertiserName = (c: AdminAdCreative) => {
    const adv = c.campaign?.advertiser;
    if (!adv) return '—';
    if (typeof adv === 'object') return adv.username ?? '—';
    return String(adv);
  };

  return (
    <AdminShell title="Ad Creatives Review" subtitle={`${pending} pending review`}>
      {error && <div className="admin-alert admin-alert--error">{error}</div>}

      <div className="admin-panel" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              className={`admin-btn ${filter === s ? 'admin-btn--primary' : ''}`}
              onClick={() => setFilter(s)}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-table-wrap admin-table--desktop">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Creative</th>
                <th>Campaign</th>
                <th>Advertiser</th>
                <th>Format</th>
                <th>Status</th>
                <th>Landing URL</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {creatives.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ color: 'var(--admin-muted)' }}>
                    No creatives with status &quot;{filter}&quot;
                  </td>
                </tr>
              ) : (
                creatives.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td style={{ maxWidth: 220 }}>
                      <strong>{c.name}</strong>
                      {c.headline ? (
                        <div style={{ fontSize: 12, color: 'var(--admin-muted)' }}>{c.headline}</div>
                      ) : null}
                      {c.primary_text ? (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--admin-muted)',
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.primary_text}
                        </div>
                      ) : null}
                    </td>
                    <td>{c.campaign?.name ?? '—'}</td>
                    <td>{advertiserName(c)}</td>
                    <td>{FORMAT_LABEL[c.format] ?? c.format}</td>
                    <td>
                      <span className={`admin-badge admin-badge--${c.status.replace('_', '-')}`}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.landing_url ? (
                        <a href={c.landing_url} target="_blank" rel="noopener noreferrer">
                          {c.landing_url}
                        </a>
                      ) : '—'}
                    </td>
                    <td>
                      {c.status === 'pending_review' && (
                        <>
                          <button
                            type="button"
                            className="admin-btn admin-btn--success"
                            style={{ marginRight: 6 }}
                            disabled={busy === c.id}
                            onClick={() => act(c.id, 'approve')}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--danger"
                            disabled={busy === c.id}
                            onClick={() => act(c.id, 'reject')}
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
        </div>

        {/* Mobile cards */}
        <div className="admin-mobile-cards">
          {creatives.map((c) => (
            <div key={c.id} className="admin-mobile-card">
              <div className="admin-mobile-card__row">
                <span className="admin-mobile-card__label">Creative</span>
                <span className="admin-mobile-card__value">{c.name}</span>
              </div>
              <div className="admin-mobile-card__row">
                <span className="admin-mobile-card__label">Campaign</span>
                <span className="admin-mobile-card__value">{c.campaign?.name ?? '—'}</span>
              </div>
              <div className="admin-mobile-card__row">
                <span className="admin-mobile-card__label">Advertiser</span>
                <span className="admin-mobile-card__value">{advertiserName(c)}</span>
              </div>
              <div className="admin-mobile-card__row">
                <span className="admin-mobile-card__label">Format</span>
                <span className="admin-mobile-card__value">{FORMAT_LABEL[c.format] ?? c.format}</span>
              </div>
              <div className="admin-mobile-card__row">
                <span className="admin-mobile-card__label">Status</span>
                <span className="admin-mobile-card__value">{c.status}</span>
              </div>
              {c.status === 'pending_review' && (
                <div className="admin-actions-wrap">
                  <button
                    type="button"
                    className="admin-btn admin-btn--success"
                    disabled={busy === c.id}
                    onClick={() => act(c.id, 'approve')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger"
                    disabled={busy === c.id}
                    onClick={() => act(c.id, 'reject')}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
