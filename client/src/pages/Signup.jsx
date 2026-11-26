import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', county: '', password: '', accept_terms: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
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
      <h2>Create your account</h2>
      <form onSubmit={handleSubmit}>
        <label>Full name
          <input name="name" value={form.name} onChange={update} required />
        </label>
        <label>Email
          <input name="email" type="email" value={form.email} onChange={update} required />
        </label>
        <label>Phone (e.g. +254712345678)
          <input name="phone" value={form.phone} onChange={update} required />
        </label>
        <label>County / City
          <input name="county" value={form.county} onChange={update} />
        </label>
        <label>Password (min 10 characters)
          <input name="password" type="password" value={form.password} onChange={update} required minLength={10} />
        </label>
                <label className="check">
          <input
            type="checkbox"
            checked={form.accept_terms}
            onChange={(e) => setForm({ ...form, accept_terms: e.target.checked })}
            required
          />
          I am 18 or older and I agree to the{' '}
          <Link to="/terms" target="_blank">Terms of Use</Link> and{' '}
          <Link to="/privacy" target="_blank">Privacy Policy</Link>
        </label>
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{busy ? 'Creating...' : 'Sign up'}</button>
      </form>
      <p>Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}