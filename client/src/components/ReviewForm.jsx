import { useState } from 'react';
import { api } from '../api';

const LABELS = { 5: 'Excellent', 4: 'Good', 3: 'Okay', 2: 'Poor', 1: 'Bad (scam, no-show, or not as described)' };

export default function ReviewForm({ offerId, otherName, onDone }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" className="link-btn" onClick={() => setOpen(true)}>
        Rate your trade with {otherName}
      </button>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/reviews', { method: 'POST', body: { offer_id: offerId, rating, comment } });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="report-box" onSubmit={submit}>
      <label>How did the trade go?
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} - {LABELS[n]}</option>)}
        </select>
      </label>
      <label>Comment (optional)
        <textarea rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Saving...' : 'Submit review'}</button>
      <button type="button" className="link-btn" onClick={() => setOpen(false)}>Cancel</button>
    </form>
  );
}