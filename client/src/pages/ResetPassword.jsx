import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('The two passwords do not match');
    setBusy(true);
    try {
      await api('/auth/reset', { method: 'POST', body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card">
        <h2>Password changed ✓</h2>
        <p>You can now log in with your new password.</p>
        <Link to="/login">Go to log in</Link>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Choose a new password</h2>
      <form onSubmit={submit}>
        <label>New password (min 10 characters)
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} />
        </label>
        <label>Repeat new password
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={10} />
        </label>
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{busy ? 'Saving...' : 'Save new password'}</button>
      </form>
      <p><Link to="/forgot-password">Need a new link?</Link></p>
    </div>
  );
}