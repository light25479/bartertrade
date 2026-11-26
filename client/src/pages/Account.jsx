import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import PasswordInput from '../components/PasswordInput';
export default function Account() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  async function submit(e) {
    e.preventDefault();
    setError('');
    setMsg('');
    if (next !== confirm) return setError('The two new passwords do not match');
    setBusy(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { current_password: current, new_password: next },
      });
      setCurrent('');
      setNext('');
      setConfirm('');
      setMsg('Password changed. Your other devices have been logged out.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function logoutAll() {
    if (!window.confirm('Log out of all other devices?')) return;
    setError('');
    setMsg('');
    try {
      await api('/auth/logout-all', { method: 'POST' });
      setMsg('All other devices have been logged out.');
    } catch (err) {
      setError(err.message);
    }
  }
    async function downloadData() {
    setError('');
    setMsg('');
    try {
      const data = await api('/auth/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bartertrade-my-data.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteAccount(e) {
    e.preventDefault();
    if (!window.confirm('This permanently deletes your account, listings, messages and reviews. It cannot be undone. Continue?')) return;
    setError('');
    try {
      await api('/auth/me', { method: 'DELETE', body: { password: deletePw } });
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div className="card">
      <h2>My account</h2>
      <p className="meta">
        {user.email} · {user.email_verified ? 'Email verified' : 'Email not verified'} ·{' '}
        {user.phone_verified ? 'Phone verified' : 'Phone not verified'}
      </p>
      <p>
        <Link to={`/user/${user.id}`}>View my public profile</Link>
        {(!user.email_verified || !user.phone_verified) && <> · <Link to="/verify">Finish verification</Link></>}
      </p>

      <h3>Change password</h3>
      <form onSubmit={submit}>
        <label>Current password
        <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </label>
        <label>New password (min 10 characters)
        <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} minLength={10} autoComplete="new-password" />
        </label>
        <label>Repeat new password
        <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={10} autoComplete="new-password" />
        </label>
        {msg && <p className="notice">{msg}</p>}
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{busy ? 'Saving...' : 'Change password'}</button>
      </form>
            <h3>Security</h3>
      <p className="meta">If you think someone else has your account, change your password above, then log out everywhere.</p>
      <button type="button" className="link-btn" onClick={logoutAll}>Log out of all devices</button>
            <h3>Your data</h3>
      <p className="meta">You can download a copy of everything we hold about you, or delete your account permanently.</p>
      <button type="button" className="link-btn" onClick={downloadData}>Download my data</button>

      <h3>Delete my account</h3>
      <form onSubmit={deleteAccount}>
        <label>Enter your password to confirm
      <PasswordInput value={deletePw} onChange={(e) => setDeletePw(e.target.value)} autoComplete="current-password" />
        </label>
        <button className="danger-btn">Delete my account</button>
      </form>
    </div>
  );
}