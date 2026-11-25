import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { CONDITIONS, priceLabel } from '../constants';
import ReportButton from '../components/ReportButton';
function ContactBox({ listing }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('message');
  const [body, setBody] = useState('');
  const [offer, setOffer] = useState({ price: '', item: '', note: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const goToThread = () => navigate(`/messages/${listing.id}/${listing.user_id}`);

  async function sendMessage(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/messages', { method: 'POST', body: { listing_id: listing.id, body } });
      goToThread();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendOffer(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/offers', {
        method: 'POST',
        body: {
          listing_id: listing.id,
          offered_price_kes: offer.price === '' ? null : Number(offer.price),
          offered_item: offer.item,
          message: offer.note,
        },
      });
      goToThread();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="contact-box">
      <div className="tabs">
        <button type="button" className={tab === 'message' ? 'on' : ''} onClick={() => setTab('message')}>Message seller</button>
        <button type="button" className={tab === 'offer' ? 'on' : ''} onClick={() => setTab('offer')}>Make an offer</button>
      </div>

      {tab === 'message' ? (
        <form onSubmit={sendMessage}>
          <label>Your message
            <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={1000}
              placeholder="Hi, is this still available?" />
          </label>
          {error && <p className="error">{error}</p>}
          <button disabled={busy}>{busy ? 'Sending...' : 'Send message'}</button>
        </form>
      ) : (
        <form onSubmit={sendOffer}>
          {listing.listing_type !== 'swap' && (
            <label>Your price (KES)
              <input type="number" min="1" value={offer.price} onChange={(e) => setOffer({ ...offer, price: e.target.value })} />
            </label>
          )}
          {listing.listing_type !== 'sell' && (
            <label>Item you would swap
              <input value={offer.item} maxLength={300} onChange={(e) => setOffer({ ...offer, item: e.target.value })} />
            </label>
          )}
          <label>Note (optional)
            <textarea rows={2} maxLength={500} value={offer.note} onChange={(e) => setOffer({ ...offer, note: e.target.value })} />
          </label>
          {error && <p className="error">{error}</p>}
          <button disabled={busy}>{busy ? 'Sending...' : 'Send offer'}</button>
        </form>
      )}
    </div>
  );
}

export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    api(`/listings/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading...</p>;

  const { listing: l, images } = data;

  return (
    <div className="detail">
      <div className="gallery">
        {images[active] && <img className="main-img" src={images[active]} alt={l.title} />}
        <div className="thumbs">
          {images.map((url, i) => (
            <img key={url} src={url} alt="" className={i === active ? 'on' : ''} onClick={() => setActive(i)} />
          ))}
        </div>
      </div>

      <div className="detail-info">
        {l.status === 'traded' && <p className="badge">This item has been traded</p>}
        <h2>{l.title}</h2>
        <p className="price big">{priceLabel(l)}</p>
        {l.wanted_in_exchange && <p><strong>Wants in exchange:</strong> {l.wanted_in_exchange}</p>}
        <p className="meta">
          {l.category} · {CONDITIONS[l.item_condition]}
          {l.county ? ` · ${l.county}` : ''}
        </p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{l.description}</p>

        <div className="seller">
        <strong><Link to={`/user/${l.user_id}`}>{l.seller_name}</Link></strong>
          <span className="meta">
            {l.seller_reviews > 0
              ? `★ ${Number(l.seller_rating).toFixed(1)} (${l.seller_reviews} ${l.seller_reviews === 1 ? 'review' : 'reviews'})`
              : 'No reviews yet'}
          </span>
          <span className="meta">
            Member since {new Date(l.seller_joined).toLocaleDateString()}
            {l.seller_county ? ` · ${l.seller_county}` : ''}
          </span>
          <span className="meta">
            {l.email_verified ? 'Email verified' : 'Email not verified'} ·{' '}
            {l.phone_verified ? 'Phone verified' : 'Phone not verified'}
          </span>
        </div>

        {!user && <p className="notice"><Link to="/login">Log in</Link> or <Link to="/signup">sign up</Link> to message the seller or make an offer.</p>}
        {user && user.id === l.user_id && <p className="notice">This is your listing. <Link to="/messages">View your messages</Link></p>}
        {user && user.id !== l.user_id && l.status === 'active' && <ContactBox listing={l} />}
        {user && user.id !== l.user_id && <ReportButton listingId={l.id} userId={l.user_id} label="Report this listing" />}

        <div className="safety">
          <strong>Stay safe</strong>
          <ul>
            <li>Meet in a busy public place, in daylight.</li>
            <li>Inspect the item before you pay or hand over yours.</li>
            <li>Never send money in advance, including "deposits" or "delivery fees".</li>
            <li>Keep conversations on BarterTrade.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}