import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api('/auth/forgot', { method: 'POST', body: { email } });
      setDone(r.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Reset your password</h2>
      {done ? (
        <>
          <p className="notice">{done}</p>
          <p className="meta">The link is valid for 1 hour. Check your spam folder too.</p>
        </>
      ) : (
        <form onSubmit={submit}>
          <label>Your account email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {error && <p className="error">{error}</p>}
          <button disabled={busy}>{busy ? 'Sending...' : 'Send reset link'}</button>
        </form>
      )}
      <p><Link to="/login">Back to log in</Link></p>
    </div>
  );
}