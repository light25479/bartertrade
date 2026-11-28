import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { CATEGORIES, CONDITIONS } from '../constants';
import { compressImage } from '../imageTools';

const MAX_PHOTOS = 5;
const MAX_ORIGINAL = 25 * 1024 * 1024; // the original, before shrinking

const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export default function NewListing() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', description: '', category: CATEGORIES[0], item_condition: 'good',
    listing_type: 'both', price_kes: '', wanted_in_exchange: '', county: '',
  });
  const [photos, setPhotos] = useState([]); // each: { id, file, url }
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Free the preview memory when leaving the page
  const photosRef = useRef([]);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function addPhotos(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = ''; // lets the same photo be chosen again later
    if (picked.length === 0) return;
    setError('');

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return setError(`You can add up to ${MAX_PHOTOS} photos`);
    if (picked.length > room) setError(`Only ${MAX_PHOTOS} photos are allowed, so some were skipped`);

    setProcessing(true);
    const added = [];
    for (const f of picked.slice(0, room)) {
      if (f.size > MAX_ORIGINAL) {
        setError('One photo was too large (over 25 MB) and was skipped');
        continue;
      }
      try {
        const small = await compressImage(f);
        added.push({ id: `${Date.now()}-${Math.random()}`, file: small, url: URL.createObjectURL(small) });
      } catch {
        setError("One photo couldn't be read. Please use a JPG or PNG photo.");
      }
    }
    setPhotos((prev) => [...prev, ...added]);
    setProcessing(false);
  }

  function removePhoto(id) {
    setPhotos((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.url);
      return prev.filter((x) => x.id !== id);
    });
  }

  function makeCover(id) {
    setPhotos((prev) => {
      const p = prev.find((x) => x.id === id);
      return p ? [p, ...prev.filter((x) => x.id !== id)] : prev;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (photos.length === 0) return setError('Please add at least one photo');
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v));
      photos.forEach((p) => body.append('images', p.file));
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
                <p className="meta">Tip: be specific. "Samsung Galaxy A14 128GB, like new" gets found far more often than "Phone for sale".</p>
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
            <input name="price_kes" type="number" min="0" inputMode="numeric" value={form.price_kes} onChange={update} />
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

        <div className="photo-field">
          <strong>Photos (1 to {MAX_PHOTOS})</strong>
          <p className="meta">
            The first photo is the cover, and it is the one shown when the listing is shared. Photos are shrunk
            automatically to save your data.
          </p>
          <div className="photo-grid">
            {photos.map((p, i) => (
              <div key={p.id} className="photo-item">
                <img src={p.url} alt="" />
                {i === 0 && <span className="cover-tag">Cover</span>}
                <span className="photo-size">{kb(p.file.size)}</span>
                <div className="photo-actions">
                  {i > 0 && <button type="button" onClick={() => makeCover(p.id)}>Make cover</button>}
                  <button type="button" onClick={() => removePhoto(p.id)}>Remove</button>
                </div>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="photo-add">
                {processing ? 'Processing...' : '+ Add photos'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={addPhotos}
                  disabled={processing}
                />
              </label>
            )}
          </div>
        </div>

        <p className="meta">Please don't put phone numbers or payment requests in your listing. Use in-app messages.</p>
        {error && <p className="error">{error}</p>}
        <button disabled={busy || processing}>{busy ? 'Uploading... please wait' : 'Post item'}</button>
      </form>
    </div>
  );
}