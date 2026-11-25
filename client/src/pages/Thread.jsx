import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import ReportButton from '../components/ReportButton';
import ReviewForm from '../components/ReviewForm';
function offerText(o) {
  const parts = [];
  if (o.offered_price_kes != null) parts.push(`KES ${Number(o.offered_price_kes).toLocaleString()}`);
  if (o.offered_item) parts.push(`swap: ${o.offered_item}`);
  return parts.join(' + ');
}

const OFFER_STATUS = { pending: 'Pending', accepted: 'Accepted', declined: 'Declined', withdrawn: 'Withdrawn' };

export default function Thread() {
  const { listingId, otherId } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [warning, setWarning] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  const load = useCallback(
    () =>
      api(`/messages/thread?listing_id=${listingId}&other_id=${otherId}`)
        .then(setData)
        .catch((e) => setError(e.message)),
    [listingId, otherId]
  );

    useEffect(() => {
    load();
    const poll = setInterval(load, 30000); // backup only
    const onEvent = (e) => {
      const ev = e.detail;
      if (ev.type === 'message' && ev.listing_id === listingId && ev.other_id === otherId) load();
    };
    window.addEventListener('bt:event', onEvent);
    return () => {
      clearInterval(poll);
      window.removeEventListener('bt:event', onEvent);
    };
  }, [load, listingId, otherId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages.length, data?.offers.length]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      const r = await api('/messages', {
        method: 'POST',
        body: { listing_id: listingId, other_user_id: otherId, body: text },
      });
      setText('');
      setWarning(r.warning || '');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function offerAction(id, action) {
    setError('');
    try {
      await api(`/offers/${id}`, { method: 'PATCH', body: { action } });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!data) return error ? <p className="error">{error}</p> : <p>Loading...</p>;

  const items = [
    ...data.messages.map((m) => ({ kind: 'm', at: m.created_at, m })),
    ...data.offers.map((o) => ({ kind: 'o', at: o.created_at, o })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));

  const listingOpen = data.listing.status === 'active';

  return (
    <div className="chat">
      <div className="chat-head">
        <Link to="/messages">&larr; Inbox</Link>
        <div>
        <Link to={`/user/${data.other.id}`}><strong>{data.other.name}</strong></Link>
          <span className="meta"> about </span>
          <Link to={`/listing/${data.listing.id}`}>{data.listing.title}</Link>
        </div>
        <ReportButton userId={data.other.id} listingId={data.listing.id} label="Report user" />
      </div>

      <p className="safety-bar">Never pay in advance or send "deposits". Meet in a public place and inspect the item first.</p>

      <div className="chat-body">
        {items.map((it) => {
          if (it.kind === 'm') {
            const mine = it.m.sender_id === user.id;
            return (
              <div key={`m${it.m.id}`} className={`bubble ${mine ? 'me' : 'them'}`}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{it.m.body}</div>
                {it.m.flagged && !mine && (
                  <div className="flag">Careful: this message mentions contact details, links or payment. Never pay in advance.</div>
                )}
                <div className="time">{new Date(it.m.created_at).toLocaleString()}</div>
              </div>
            );
          }
          const o = it.o;
          return (
            <div key={`o${o.id}`} className="offer-card">
              <strong>Offer: {offerText(o)}</strong>
              {o.message && <div>{o.message}</div>}
              <div className="meta">{OFFER_STATUS[o.status]} · {new Date(o.created_at).toLocaleString()}</div>
              {o.status === 'pending' && data.iAmOwner && listingOpen && (
                <div className="actions">
                  <button onClick={() => offerAction(o.id, 'accept')}>Accept</button>
                  <button className="danger" onClick={() => offerAction(o.id, 'decline')}>Decline</button>
                </div>
              )}
              {o.status === 'pending' && !data.iAmOwner && (
                <div className="actions">
                  <button className="danger" onClick={() => offerAction(o.id, 'withdraw')}>Withdraw offer</button>
                </div>
              )}
              {o.status === 'accepted' && (
                <div className="meta">Arrange a safe meet-up and inspect the item. When the trade is done, the seller can mark the listing as traded in My listings.</div>
              )}
                            {o.status === 'accepted' && (
                o.reviewed
                  ? <div className="meta">You reviewed this trade ✓</div>
                  : <ReviewForm offerId={o.id} otherName={data.other.name} onDone={load} />
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {warning && <p className="notice">{warning}</p>}
      {error && <p className="error">{error}</p>}

            <form className="chat-form" onSubmit={send}>
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="Type your reply... (Enter to send, Shift+Enter for a new line)"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form.requestSubmit();
            }
          }}
        />
        <button disabled={busy}>{busy ? 'Sending...' : 'Send reply'}</button>
      </form>
    </div>
  );
}