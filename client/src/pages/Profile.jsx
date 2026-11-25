import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import ListingCard from '../components/ListingCard';
import Stars from '../components/Stars';
import ReportButton from '../components/ReportButton';

export default function Profile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(
    () => api(`/reviews/user/${id}`).then(setData).catch((e) => setError(e.message)),
    [id]
  );
  useEffect(() => { load(); }, [load]);

  async function removeReview(reviewId) {
    if (!window.confirm('Delete this review?')) return;
    try {
      await api(`/admin/reviews/${reviewId}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading...</p>;

  const { user: u, summary, reviews, listings } = data;

  return (
    <div>
      <div className="profile-head">
        <h2>{u.name}</h2>
        <p className="meta">
          Member since {new Date(u.created_at).toLocaleDateString()}
          {u.county ? ` · ${u.county}` : ''} · {u.email_verified ? 'Email verified' : 'Email not verified'} ·{' '}
          {u.phone_verified ? 'Phone verified' : 'Phone not verified'}
        </p>
        <p>
          {summary.count > 0 ? (
            <>
              <Stars value={summary.avg} /> <strong>{Number(summary.avg).toFixed(1)}</strong>{' '}
              <span className="meta">({summary.count} {summary.count === 1 ? 'review' : 'reviews'})</span>
            </>
          ) : (
            <span className="meta">No reviews yet</span>
          )}
        </p>
        {user && user.id !== u.id && <ReportButton userId={u.id} label="Report this user" />}
      </div>

      <h3>Items for trade</h3>
      {listings.length === 0 && <p className="meta">No active listings.</p>}
      <div className="grid">
        {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
      </div>

      <h3>Reviews</h3>
      {reviews.length === 0 && <p className="meta">Nobody has reviewed this person yet.</p>}
      {reviews.map((r) => (
        <div key={r.id} className="review">
          <Stars value={r.rating} /> <span className="meta">by {r.reviewer_name} · {new Date(r.created_at).toLocaleDateString()}</span>
          <div className="meta">Item: {r.listing_title}</div>
          {r.comment && <p style={{ whiteSpace: 'pre-wrap' }}>{r.comment}</p>}
          {user && user.role === 'admin' && (
            <button type="button" className="link-btn" onClick={() => removeReview(r.id)}>Delete review (admin)</button>
          )}
        </div>
      ))}
    </div>
  );
}