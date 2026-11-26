import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api';
import { priceLabel, thumb } from '../constants';

const STATUS_LABEL = { active: 'Live', traded: 'Traded', pending_review: 'Under review' };

export default function MyListings() {
  const location = useLocation();
  const notice = location.state?.notice;
  const [listings, setListings] = useState(null);
  const [error, setError] = useState('');

  const load = () => api('/listings/mine/all').then((d) => setListings(d.listings)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function setStatus(id, status) {
    if (status === 'removed' && !window.confirm('Remove this listing?')) return;
    try {
      await api(`/listings/${id}/status`, { method: 'PATCH', body: { status } });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <h2>My listings</h2>
      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
      {!listings && !error && <p>Loading...</p>}
      {listings && listings.length === 0 && <p>You haven't posted anything yet. <Link to="/new">Post your first item</Link></p>}

      {listings && listings.map((l) => (
        <div key={l.id} className="my-row">
         {l.image_url && <img src={thumb(l.image_url, 160)} alt="" />}
          <div className="grow">
            {l.status === 'pending_review'
              ? <strong>{l.title}</strong>
              : <Link to={`/listing/${l.id}`}><strong>{l.title}</strong></Link>}
            <div className="meta">{priceLabel(l)} · {STATUS_LABEL[l.status]}</div>
          </div>
                    {l.status === 'active' && (
            <a
              className="share-btn wa"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(`${l.title} – ${priceLabel(l)} on BarterTrade: ${window.location.origin}/listing/${l.id}`)}`}
            >
              Share
            </a>
          )}
          {l.status === 'active' && <button onClick={() => setStatus(l.id, 'traded')}>Mark traded</button>}
          <button className="danger" onClick={() => setStatus(l.id, 'removed')}>Remove</button>
        </div>
      ))}
    </div>
  );
}