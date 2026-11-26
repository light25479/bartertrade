import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import PasswordInput from '../components/PasswordInput';
export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', county: '', password: '', accept_terms: false,
  });
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const mismatch = confirm.length > 0 && form.password !== confirm;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== confirm) return setError('The two passwords do not match');
    setBusy(true);
    try {
      await signup(form);
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
      <h2>Create your account</h2>
      <form onSubmit={handleSubmit}>
        <label>Full name
          <input name="name" value={form.name} onChange={update} required autoComplete="name" />
        </label>
        <label>Email
          <input name="email" type="email" value={form.email} onChange={update} required autoComplete="email" />
        </label>
        <label>Phone (e.g. +254712345678)
          <input name="phone" type="tel" value={form.phone} onChange={update} required autoComplete="tel" />
        </label>
        <label>County / City
          <input name="county" value={form.county} onChange={update} />
        </label>
        <label>Password (min 10 characters)
          <PasswordInput name="password" value={form.password} onChange={update} minLength={10} autoComplete="new-password" />
        </label>
        <label>Confirm password
          <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={10} autoComplete="new-password" />
        </label>
        {mismatch && <p className="error">Passwords do not match</p>}
        {confirm.length > 0 && !mismatch && <p className="ok">Passwords match ✓</p>}

        <label className="check">
          <input
            type="checkbox"
            checked={form.accept_terms}
            onChange={(e) => setForm({ ...form, accept_terms: e.target.checked })}
            required
          />
          <span>
            I am 18 or older and I agree to the{' '}
            <Link to="/terms" target="_blank">Terms of Use</Link> and{' '}
            <Link to="/privacy" target="_blank">Privacy Policy</Link>
          </span>
        </label>

        {error && <p className="error">{error}</p>}
        <button disabled={busy || mismatch}>{busy ? 'Creating...' : 'Sign up'}</button>
      </form>
      <p>Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}