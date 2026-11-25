import { useState } from 'react';
import { api } from '../api';

const REASONS = {
  scam: 'Scam or fraud',
  prohibited: 'Prohibited or illegal item',
  misleading: 'Fake or misleading listing',
  harassment: 'Harassment or abuse',
  other: 'Something else',
};

export default function ReportButton({ listingId, userId, label = 'Report' }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('scam');
  const [details, setDetails] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/reports', {
        method: 'POST',
        body: { listing_id: listingId || null, reported_user_id: userId || null, reason, details },
      });
      setDone(true);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <span className="meta">Thanks. Our team will review your report.</span>;

  if (!open) {
    return <button type="button" className="link-btn" onClick={() => setOpen(true)}>{label}</button>;
  }

  return (
    <form className="report-box" onSubmit={submit}>
      <label>Reason
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label>Details (optional)
        <textarea rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Sending...' : 'Submit report'}</button>
      <button type="button" className="link-btn" onClick={() => setOpen(false)}>Cancel</button>
    </form>
  );
}