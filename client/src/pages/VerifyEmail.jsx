import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { refresh } = useAuth();
  const [state, setState] = useState('working');
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // prevents a double request in development
    ran.current = true;
    api('/verify/email/confirm', { method: 'POST', body: { token } })
      .then(() => {
        setState('ok');
        refresh();
      })
      .catch((e) => {
        setError(e.message);
        setState('error');
      });
  }, [token, refresh]);

  return (
    <div className="card">
      {state === 'working' && <p>Verifying your email...</p>}
      {state === 'ok' && (
        <>
          <h2>Email verified ✓</h2>
          <p>Thank you. Next, verify your phone number so you can post items.</p>
          <Link to="/verify">Continue</Link>
        </>
      )}
      {state === 'error' && (
        <>
          <h2>Could not verify</h2>
          <p className="error">{error}</p>
          <Link to="/verify">Go to the Verify page</Link>
        </>
      )}
    </div>
  );
}