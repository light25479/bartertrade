import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { priceLabel } from '../constants';

function HeldListings({ onChange }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(
    () => api('/admin/listings/pending').then((d) => setItems(d.listings)).catch((e) => setError(e.message)),
    []
  );
  useEffect(() => { load(); }, [load]);

  async function decide(id, status) {
    if (status === 'removed' && !window.confirm('Remove this listing?')) return;
    try {
      await api(`/admin/listings/${id}/status`, { method: 'PATCH', body: { status } });
      await load();
      onChange();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!items) return error ? <p className="error">{error}</p> : <p>Loading...</p>;
  if (items.length === 0) return <p>Nothing waiting for review.</p>;

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {items.map((l) => (
        <div key={l.id} className="admin-card">
          <div className="thumbs-row">
            {l.images.map((u) => <img key={u} src={u} alt="" />)}
          </div>
          <strong>{l.title}</strong> <span className="meta">{priceLabel(l)} · {l.category}</span>
          {l.wanted_in_exchange && <div className="meta">Wants: {l.wanted_in_exchange}</div>}
          <p style={{ whiteSpace: 'pre-wrap' }}>{l.description}</p>
          <div className="meta">
            Seller: {l.seller_name} ({l.seller_email}), joined {new Date(l.seller_joined).toLocaleDateString()}
          </div>
          <div className="actions">
            <button onClick={() => decide(l.id, 'active')}>Approve</button>
            <button className="danger" onClick={() => decide(l.id, 'removed')}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Reports({ onChange }) {
  const [status, setStatus] = useState('open');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(
    () => api(`/admin/reports?status=${status}`).then((d) => setItems(d.reports)).catch((e) => setError(e.message)),
    [status]
  );
  useEffect(() => { setItems(null); load(); }, [load]);

  async function act(fn) {
    setError('');
    try {
      await fn();
      await load();
      onChange();
    } catch (e) {
      setError(e.message);
    }
  }

  const closeReport = (id, s) => act(() => api(`/admin/reports/${id}`, { method: 'PATCH', body: { status: s } }));
  const removeListing = (id) =>
    window.confirm('Remove this listing?') &&
    act(() => api(`/admin/listings/${id}/status`, { method: 'PATCH', body: { status: 'removed' } }));
  const suspend = (id) =>
    window.confirm('Suspend this user? They will be logged out and unable to use the site.') &&
    act(() => api(`/admin/users/${id}/status`, { method: 'PATCH', body: { status: 'suspended' } }));

  return (
    <div>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="admin-select">
        <option value="open">Open reports</option>
        <option value="resolved">Resolved</option>
        <option value="dismissed">Dismissed</option>
      </select>
      {error && <p className="error">{error}</p>}
      {!items && !error && <p>Loading...</p>}
      {items && items.length === 0 && <p>No {status} reports.</p>}
      {items && items.map((r) => {
        const targetUserId = r.reported_user_id || r.seller_id;
        const targetUserName = r.reported_user_name || r.seller_name;
        const viewable = r.listing_status === 'active' || r.listing_status === 'traded';
        return (
          <div key={r.id} className="admin-card">
            <strong>{r.reason}</strong>
            <span className="meta"> · reported by {r.reporter_name} · {new Date(r.created_at).toLocaleString()}</span>
            {r.details && <p style={{ whiteSpace: 'pre-wrap' }}>{r.details}</p>}
            {r.listing_id && (
              <div className="meta">
                Listing: {viewable ? <Link to={`/listing/${r.listing_id}`}>{r.listing_title}</Link> : r.listing_title} ({r.listing_status})
              </div>
            )}
            {targetUserId && <div className="meta">User: {targetUserName}</div>}
            {r.status === 'open' && (
              <div className="actions">
                {r.listing_id && r.listing_status !== 'removed' && (
                  <button className="danger" onClick={() => removeListing(r.listing_id)}>Remove listing</button>
                )}
                {targetUserId && <button className="danger" onClick={() => suspend(targetUserId)}>Suspend user</button>}
                <button onClick={() => closeReport(r.id, 'resolved')}>Mark resolved</button>
                <button onClick={() => closeReport(r.id, 'dismissed')}>Dismiss</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Users() {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(
    () => api(`/admin/users?search=${encodeURIComponent(search)}`).then((d) => setUsers(d.users)).catch((e) => setError(e.message)),
    [search]
  );
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function setStatus(id, status) {
    if (status === 'suspended' && !window.confirm('Suspend this user?')) return;
    try {
      await api(`/admin/users/${id}/status`, { method: 'PATCH', body: { status } });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <input className="admin-search" placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
      {error && <p className="error">{error}</p>}
      {users && users.map((u) => (
        <div key={u.id} className="my-row">
          <div className="grow">
            <strong>{u.name}</strong> <span className="meta">{u.email} · {u.phone}{u.county ? ` · ${u.county}` : ''}</span>
            <div className="meta">
              {u.role} · {u.status} · {u.listings} listings · {u.open_reports} open reports · joined {new Date(u.created_at).toLocaleDateString()}
            </div>
          </div>
          {u.role === 'user' && u.status === 'active' && (
            <button className="danger" onClick={() => setStatus(u.id, 'suspended')}>Suspend</button>
          )}
          {u.role === 'user' && u.status === 'suspended' && (
            <button onClick={() => setStatus(u.id, 'active')}>Reactivate</button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('held');
  const [stats, setStats] = useState(null);
  const refreshStats = useCallback(() => api('/admin/stats').then(setStats).catch(() => {}), []);
  useEffect(() => { refreshStats(); }, [refreshStats]);

  return (
    <div>
      <h2>Admin</h2>
      {stats && (
        <div className="stats">
          <div><strong>{stats.users}</strong><span>Users</span></div>
          <div><strong>{stats.active_listings}</strong><span>Live listings</span></div>
          <div><strong>{stats.pending_listings}</strong><span>Held for review</span></div>
          <div><strong>{stats.open_reports}</strong><span>Open reports</span></div>
        </div>
      )}
      <div className="tabs">
        <button className={tab === 'held' ? 'on' : ''} onClick={() => setTab('held')}>Held listings</button>
        <button className={tab === 'reports' ? 'on' : ''} onClick={() => setTab('reports')}>Reports</button>
        <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>Users</button>
      </div>
      {tab === 'held' && <HeldListings onChange={refreshStats} />}
      {tab === 'reports' && <Reports onChange={refreshStats} />}
      {tab === 'users' && <Users />}
    </div>
  );
}