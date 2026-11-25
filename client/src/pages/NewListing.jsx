import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { CATEGORIES, CONDITIONS } from '../constants';

export default function NewListing() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', description: '', category: CATEGORIES[0], item_condition: 'good',
    listing_type: 'both', price_kes: '', wanted_in_exchange: '', county: '',
  });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  function pickFiles(e) {
    const picked = Array.from(e.target.files);
    if (picked.length > 5) return setError('You can upload up to 5 photos');
    if (picked.some((f) => f.size > 5 * 1024 * 1024)) return setError('Each photo must be under 5 MB');
    setError('');
    setFiles(picked);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (files.length === 0) return setError('Please add at least one photo');
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v));
      files.forEach((f) => body.append('images', f));
      const res = await api('/listings', { method: 'POST', body });
      navigate('/my-listings', { state: { notice: res.notice } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const showPrice = form.listing_type !== 'swap';
  const showWants = form.listing_type !== 'sell';

  return (
    <div className="card">
      <h2>Post an item</h2>
      <form onSubmit={handleSubmit}>
        <label>Title
          <input name="title" value={form.title} onChange={update} required maxLength={100} />
        </label>
        <label>Category
          <select name="category" value={form.category} onChange={update}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>Condition
          <select name="item_condition" value={form.item_condition} onChange={update}>
            {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>I want to
          <select name="listing_type" value={form.listing_type} onChange={update}>
            <option value="sell">Sell it</option>
            <option value="swap">Swap it</option>
            <option value="both">Sell or swap</option>
          </select>
        </label>
        {showPrice && (
          <label>Price (KES)
            <input name="price_kes" type="number" min="0" value={form.price_kes} onChange={update} />
          </label>
        )}
        {showWants && (
          <label>What would you like in exchange?
            <input name="wanted_in_exchange" value={form.wanted_in_exchange} onChange={update} maxLength={300} />
          </label>
        )}
        <label>County / City
          <input name="county" value={form.county} onChange={update} />
        </label>
        <label>Description
          <textarea name="description" rows={5} value={form.description} onChange={update} required maxLength={2000} />
        </label>
        <label>Photos (1 to 5, JPG/PNG/WebP, max 5 MB each)
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={pickFiles} />
        </label>
        <p className="meta">Please don't put phone numbers or payment requests in your listing. Use in-app messages.</p>
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{busy ? 'Uploading...' : 'Post item'}</button>
      </form>
    </div>
  );
}