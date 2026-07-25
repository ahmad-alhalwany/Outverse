'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { deleteShopItem, fetchAdminDashboard, fetchShopItemsAdmin, saveShopItem } from '@/lib/adminApi';
import type { AdminShopItem } from '@/lib/adminTypes';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

const EMPTY = {
  name: '',
  description: '',
  price: 100,
  type: 'digital',
  category: 'art',
  cover_url: '',
  is_featured: false,
  is_available: true,
};

export default function AdminShopPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<AdminShopItem[]>([]);
  const [shopStats, setShopStats] = useState<{
    orders_today: number;
    revenue_today: number;
    total_orders: number;
  } | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    fetchShopItemsAdmin().then(setItems).catch(() => setMsg('Failed to load shop'));
    fetchAdminDashboard()
      .then((data) => setShopStats(data.shop))
      .catch(() => setShopStats(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY);
  };

  const openEdit = (item: AdminShopItem) => {
    setEditId(item.id);
    setForm({
      name: item.name,
      description: item.description,
      price: item.price,
      type: item.type,
      category: item.category,
      cover_url: item.cover_url || '',
      is_featured: item.is_featured,
      is_available: item.is_available,
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await saveShopItem(form, editId ?? undefined);
    if (res.ok) {
      setMsg(editId ? 'Product updated.' : 'Product created.');
      setEditId(null);
      setForm(EMPTY);
      load();
    } else {
      setMsg('Save failed.');
    }
  };

  const remove = async (id: number) => {
    if (!(await confirm('Delete this product?', { danger: true, confirmLabel: 'Delete' }))) return;
    const res = await deleteShopItem(id);
    if (res.ok) {
      setMsg('Product removed.');
      load();
    }
  };

  const featured = items.filter((i) => i.is_featured).slice(0, 3);

  return (
    <AdminShell
      title="Madness Shop"
      subtitle="Seller dashboard — products, stock, and featured items"
      actions={
        <button type="button" className="admin-btn admin-btn--primary" onClick={openCreate}>
          + Add product
        </button>
      }
    >
      {msg && <div className="admin-alert admin-alert--success">{msg}</div>}

      <div className="admin-kpi-grid">
        <div className="admin-kpi admin-kpi--warm">
          <div className="admin-kpi__label">Revenue today</div>
          <div className="admin-kpi__value">{shopStats?.revenue_today ?? 0} ✨</div>
        </div>
        <div className="admin-kpi admin-kpi--warm">
          <div className="admin-kpi__label">Orders today</div>
          <div className="admin-kpi__value">{shopStats?.orders_today ?? 0}</div>
        </div>
        <div className="admin-kpi admin-kpi--warm">
          <div className="admin-kpi__label">Total orders</div>
          <div className="admin-kpi__value">{shopStats?.total_orders ?? 0}</div>
        </div>
        <div className="admin-kpi admin-kpi--warm">
          <div className="admin-kpi__label">Active products</div>
          <div className="admin-kpi__value">{items.filter((i) => i.is_available).length}</div>
        </div>
        <div className="admin-kpi admin-kpi--warm">
          <div className="admin-kpi__label">Featured</div>
          <div className="admin-kpi__value">{items.filter((i) => i.is_featured).length}</div>
        </div>
        <div className="admin-kpi admin-kpi--warm">
          <div className="admin-kpi__label">Total catalog</div>
          <div className="admin-kpi__value">{items.length}</div>
        </div>
      </div>

      {featured.length > 0 && (
        <div className="admin-panel admin-panel--light">
          <h3 className="admin-panel__title">Featured this week</h3>
          <div className="admin-shop-featured">
            {featured.map((item) => (
              <div key={item.id} className="admin-shop-card">
                <strong>{item.name}</strong>
                <div className="admin-shop-card__price">{item.price} coins</div>
                <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>Stock: {item.sales_count} sales</p>
                <span className="admin-badge admin-badge--featured">Featured</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="admin-grid-2">
        <div className="admin-panel">
          <h3 className="admin-panel__title">All products</h3>
          <div className="admin-table-wrap admin-table--desktop">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.price}</td>
                    <td>
                      {!item.is_available && <span className="admin-badge admin-badge--rejected">Hidden</span>}
                      {item.is_featured && <span className="admin-badge admin-badge--featured">Featured</span>}
                    </td>
                    <td>
                      <button type="button" className="admin-btn admin-btn--ghost" onClick={() => openEdit(item)}>Edit</button>
                      <button type="button" className="admin-btn admin-btn--danger" style={{ marginLeft: 6 }} onClick={() => remove(item.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-mobile-cards">
            {items.map((item) => (
              <div key={item.id} className="admin-mobile-card">
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Name</span><span className="admin-mobile-card__value">{item.name}</span></div>
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Price</span><span className="admin-mobile-card__value">{item.price}</span></div>
                <div className="admin-mobile-card__row"><span className="admin-mobile-card__label">Status</span><span className="admin-mobile-card__value">{item.is_available ? 'Visible' : 'Hidden'}{item.is_featured ? ' · Featured' : ''}</span></div>
                <div className="admin-actions-wrap">
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => openEdit(item)}>Edit</button>
                  <button type="button" className="admin-btn admin-btn--danger" onClick={() => remove(item.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-panel">
          <h3 className="admin-panel__title">{editId ? 'Edit product' : 'New product'}</h3>
          <form onSubmit={submit}>
            <div className="admin-form-row">
              <label>Name</label>
              <input className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="admin-form-row">
              <label>Description</label>
              <textarea className="admin-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            </div>
            <div className="admin-form-row">
              <label>Price (coins)</label>
              <input className="admin-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required />
            </div>
            <div className="admin-form-row">
              <label>Category</label>
              <select className="admin-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {['art', 'template', 'story', 'design', 'music', 'effect', 'other'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="admin-form-row">
              <label>Cover URL</label>
              <input className="admin-input" value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} />
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, fontSize: '0.85rem' }}>
              <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
              Featured
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: '0.85rem' }}>
              <input type="checkbox" checked={form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} />
              Available in shop
            </label>
            <button type="submit" className="admin-btn admin-btn--primary">{editId ? 'Save changes' : 'Create product'}</button>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}
