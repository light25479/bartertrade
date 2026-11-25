import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function Verify() {
  const { user, refresh } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setError('');
    setMsg('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const resendEmail = () =>
    run(async () => {
      await api('/verify/email/send', { method: 'POST' });
      setMsg('Verification email sent. Check your inbox and your spam folder.');
    });

  const sendCode = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await api('/verify/phone/send', { method: 'POST', body: { phone } });
      setPhone(r.phone);
      setCodeSent(true);
      setMsg('We sent a 6-digit code by SMS. It expires in 10 minutes.');
    });
  };

  const confirmCode = (e) => {
    e.preventDefault();
    run(async () => {
      await api('/verify/phone/confirm', { method: 'POST', body: { code } });
      await refresh();
      setMsg('Your phone number is verified.');
    });
  };
  const allDone = user.email_verified && (user.phone_verified || !user.phone_verification_required);

  return (
    <div className="card">
      <h2>Verify your account</h2>
      <p className="meta">Verified accounts keep BarterTrade safe from scams. You need a verified email to message people, and both to post items.</p>

      {msg && <p className="notice">{msg}</p>}
      {error && <p className="error">{error}</p>}

      <h3>1. Email {user.email_verified ? '✓' : ''}</h3>
      {user.email_verified ? (
        <p className="meta">{user.email} is verified.</p>
      ) : (
        <>
          <p>We sent a link to <strong>{user.email}</strong>. Open it to verify.</p>
          <div className="row-buttons">
            <button type="button" className="link-btn" disabled={busy} onClick={resendEmail}>Send the email again</button>
            <button type="button" className="link-btn" onClick={refresh}>I clicked the link, refresh</button>
          </div>
        </>
      )}

      <h3>2. Phone {user.phone_verified ? '✓' : ''}</h3>
            {!user.phone_verification_required ? (
        <p className="meta">Phone verification is not required right now.</p>
      ) : user.phone_verified ? (
        <p className="meta">Your phone number is verified.</p>
      ) : !user.email_verified ? (
        <p className="meta">Verify your email first.</p>
      ) : !codeSent ? (
        <form onSubmit={sendCode}>
          <label>Phone number (e.g. +254712345678 or 0712345678)
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
          <button disabled={busy}>{busy ? 'Sending...' : 'Send code by SMS'}</button>
        </form>
      ) : (
        <form onSubmit={confirmCode}>
          <label>6-digit code sent to {phone}
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} required />
          </label>
          <button disabled={busy}>{busy ? 'Checking...' : 'Verify phone'}</button>
          <button type="button" className="link-btn" onClick={() => { setCodeSent(false); setCode(''); }}>
            Use a different number
          </button>
        </form>
      )}

      {allDone && <p className="notice">You're fully verified. <Link to="/new">Post an item</Link></p>}
    </div>
  );
}