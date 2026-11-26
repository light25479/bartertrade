import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import PasswordInput from '../components/PasswordInput';
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
    <div className="auth-logo"><img src="/logo.png" alt="BarterTrade - Swap, Sell, Get More" /></div>
      <h2>Log in</h2>
      <form onSubmit={handleSubmit}>
        <label>Email
          <input name="email" type="email" value={form.email} onChange={update} required autoComplete="email" />
        </label>
        <label>Password
          <PasswordInput name="password" value={form.password} onChange={update} autoComplete="current-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
      </form>
      <p>New here? <Link to="/signup">Create an account</Link></p>
      <p><Link to="/forgot-password">Forgot your password?</Link></p>
    </div>
  );
}