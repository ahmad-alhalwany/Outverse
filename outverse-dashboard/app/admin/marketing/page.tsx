'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import {
  createMarketingCampaign,
  deleteMarketingCampaign,
  fetchMarketingCampaigns,
  previewMarketingCampaign,
  sendMarketingCampaign,
  updateMarketingCampaign,
  type MarketingCampaign,
  type MarketingSegment,
} from '@/lib/adminApi';

const EMPTY = {
  subject: '',
  body_html: '',
  segment: 'all' as MarketingSegment,
};

const SEGMENT_LABELS: Record<MarketingSegment, string> = {
  all: 'All opted-in users',
  inactive_30d: 'Opted-in, inactive 30+ days',
};

export default function AdminMarketingPage() {
  const confirm = useConfirm();
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [previewCounts, setPreviewCounts] = useState<Record<number, number>>({});
  const [sendingId, setSendingId] = useState<number | null>(null);

  const load = useCallback(() => {
    fetchMarketingCampaigns().then(setCampaigns).catch(() => setMsg('Failed to load campaigns.'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = editId
        ? await updateMarketingCampaign(editId, form)
        : await createMarketingCampaign(form);
      if (res.ok) {
        setMsg(editId ? 'Campaign updated.' : 'Campaign created as a draft.');
        setEditId(null);
        setForm(EMPTY);
        load();
      } else {
        setMsg('Save failed.');
      }
    } catch {
      setMsg('Save failed.');
    }
  };

  const doPreview = async (id: number) => {
    try {
      const { recipient_count } = await previewMarketingCampaign(id);
      setPreviewCounts((prev) => ({ ...prev, [id]: recipient_count }));
    } catch {
      setMsg('Failed to preview recipients.');
    }
  };

  const doSend = async (campaign: MarketingCampaign) => {
    const count = previewCounts[campaign.id];
    const countNote = count !== undefined ? ` to ${count} recipient(s)` : '';
    if (!(await confirm(`Send "${campaign.subject}"${countNote}? This cannot be undone.`, {
      danger: true,
      confirmLabel: 'Send now',
    }))) {
      return;
    }
    setSendingId(campaign.id);
    try {
      const res = await sendMarketingCampaign(campaign.id);
      if (res.ok) {
        setMsg('Campaign sent.');
        load();
      } else {
        setMsg('Send failed.');
      }
    } finally {
      setSendingId(null);
    }
  };

  const doDelete = async (id: number) => {
    if (!(await confirm('Delete this draft?', { danger: true, confirmLabel: 'Delete' }))) return;
    const res = await deleteMarketingCampaign(id);
    if (res.ok) load();
    else setMsg('Failed to delete campaign.');
  };

  const startEdit = (c: MarketingCampaign) => {
    setEditId(c.id);
    setForm({ subject: c.subject, body_html: c.body_html, segment: c.segment });
  };

  return (
    <AdminShell
      title="Marketing Campaigns"
      subtitle="Compose and send a one-off email to an opted-in user segment — separate from the automatic activity digest"
      actions={
        <button type="button" className="admin-btn admin-btn--primary" onClick={() => { setEditId(null); setForm(EMPTY); }}>
          + New campaign
        </button>
      }
    >
      {msg && <div className="admin-alert admin-alert--success">{msg}</div>}

      <div className="admin-grid-2">
        <div className="admin-panel">
          <h3 className="admin-panel__title">All campaigns ({campaigns.length})</h3>
          <div className="admin-table-wrap admin-table--desktop">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Segment</th>
                  <th>Status</th>
                  <th>Recipients</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>{c.subject}</td>
                    <td>{SEGMENT_LABELS[c.segment]}</td>
                    <td>{c.status}</td>
                    <td>{c.status === 'sent' ? c.recipient_count : (previewCounts[c.id] ?? '—')}</td>
                    <td className="admin-actions-wrap">
                      {c.status === 'draft' && (
                        <>
                          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => startEdit(c)}>Edit</button>
                          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void doPreview(c.id)}>Preview</button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--primary"
                            disabled={sendingId === c.id}
                            onClick={() => void doSend(c)}
                          >
                            {sendingId === c.id ? 'Sending…' : 'Send'}
                          </button>
                          <button type="button" className="admin-btn admin-btn--danger" onClick={() => void doDelete(c.id)}>Delete</button>
                        </>
                      )}
                      {c.status === 'sending' && <span className="admin-muted">Sending…</span>}
                      {c.status === 'sent' && (
                        <span className="admin-muted">Sent {c.sent_at ? new Date(c.sent_at).toLocaleString() : ''}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr><td colSpan={5} className="admin-muted">No campaigns yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="admin-mobile-cards">
            {campaigns.map((c) => (
              <div key={c.id} className="admin-mobile-card">
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Subject</span><span className="admin-mobile-card__value">{c.subject}</span></div>
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Segment</span><span className="admin-mobile-card__value">{SEGMENT_LABELS[c.segment]}</span></div>
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Status</span><span className="admin-mobile-card__value">{c.status}</span></div>
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Recipients</span><span className="admin-mobile-card__value">{c.status === 'sent' ? c.recipient_count : (previewCounts[c.id] ?? '—')}</span></div>
                {c.status === 'draft' && (
                  <div className="admin-actions-wrap">
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => startEdit(c)}>Edit</button>
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void doPreview(c.id)}>Preview</button>
                    <button type="button" className="admin-btn admin-btn--primary" disabled={sendingId === c.id} onClick={() => void doSend(c)}>
                      {sendingId === c.id ? 'Sending…' : 'Send'}
                    </button>
                    <button type="button" className="admin-btn admin-btn--danger" onClick={() => void doDelete(c.id)}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="admin-panel">
          <h3 className="admin-panel__title">{editId ? 'Edit draft' : 'Compose campaign'}</h3>
          <form onSubmit={submit}>
            <div className="admin-form-row">
              <label>Subject</label>
              <input className="admin-input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
            </div>
            <div className="admin-form-row">
              <label>Segment</label>
              <select
                className="admin-input"
                value={form.segment}
                onChange={(e) => setForm({ ...form, segment: e.target.value as MarketingSegment })}
              >
                {(Object.entries(SEGMENT_LABELS) as [MarketingSegment, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="admin-form-row">
              <label>Body (HTML)</label>
              <textarea
                className="admin-input"
                rows={8}
                value={form.body_html}
                onChange={(e) => setForm({ ...form, body_html: e.target.value })}
                placeholder="<p>Hi there, here's what's new...</p>"
                required
              />
            </div>
            <p className="admin-muted" style={{ fontSize: '0.78rem', marginBottom: 10 }}>
              An unsubscribe/preferences note is appended automatically. Only users who opted into
              &ldquo;Product news &amp; tips&rdquo; in their email settings will receive this.
            </p>
            <button type="submit" className="admin-btn admin-btn--primary">{editId ? 'Save draft' : 'Create draft'}</button>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}
