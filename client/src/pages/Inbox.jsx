import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function Inbox() {
  const [convos, setConvos] = useState(null);
  const [error, setError] = useState('');

   useEffect(() => {
    const load = () =>
      api('/messages/inbox').then((d) => setConvos(d.conversations)).catch((e) => setError(e.message));
    load();
    window.addEventListener('bt:event', load);
    return () => window.removeEventListener('bt:event', load);
  }, []);

  return (
    <div>
      <h2>Messages</h2>
      {error && <p className="error">{error}</p>}
      {!convos && !error && <p>Loading...</p>}
      {convos && convos.length === 0 && <p>No messages yet. Open an item and message the seller to start a conversation.</p>}
      {convos && convos.map((c) => (
        <Link key={`${c.listing_id}-${c.other_id}`} to={`/messages/${c.listing_id}/${c.other_id}`} className="convo-row">
          <div className="grow">
            <strong>{c.other_name}</strong>
            <span className="meta"> about {c.listing_title}</span>
            <div className="meta">{c.body.length > 80 ? `${c.body.slice(0, 80)}...` : c.body}</div>
          </div>
                    {c.unread > 0 && <span className="count">{c.unread}</span>}
          <span className="reply-btn">Reply</span>
        </Link>
      ))}
    </div>
  );
}