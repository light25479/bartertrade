import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { CATEGORIES, categoryFromSlug, slugify } from '../constants';
import ListingCard from '../components/ListingCard';
import usePageTitle from '../usePageTitle';

export default function Home() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const category = slug ? categoryFromSlug(slug) : '';
  const unknownCategory = Boolean(slug) && !category;

  const [filters, setFilters] = useState({ search: '', type: '', county: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ listings: [], totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  usePageTitle(category ? `${category} for sale or swap in Kenya` : '');

  useEffect(() => { setPage(1); }, [category]);

  useEffect(() => {
    if (unknownCategory) return undefined;
    let cancelled = false;
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    if (category) params.set('category', category);
    params.set('page', page);
    setLoading(true);

    const timer = setTimeout(() => {
      api(`/listings?${params}`)
        .then((d) => { if (!cancelled) { setData(d); setError(''); } })
        .catch((e) => { if (!cancelled) setError(e.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 300);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [filters, page, category, unknownCategory]);

  function update(e) {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    setPage(1);
  }

  function pickCategory(e) {
    navigate(e.target.value ? `/category/${slugify(e.target.value)}` : '/');
  }

  if (unknownCategory) {
    return (
      <div>
        <h2>Category not found</h2>
        <p><Link to="/">See all items</Link></p>
      </div>
    );
  }

  return (
    <div>
      <h2>{category ? `${category} for sale or swap` : "Trade what you don't need for what you do"}</h2>

      <nav className="chips" aria-label="Categories">
        <Link to="/" className={`chip${category ? '' : ' on'}`}>All</Link>
        {CATEGORIES.map((c) => (
          <Link key={c} to={`/category/${slugify(c)}`} className={`chip${c === category ? ' on' : ''}`}>{c}</Link>
        ))}
      </nav>

      <div className="filters">
        <input name="search" placeholder="Search items..." value={filters.search} onChange={update} />
        <select value={category} onChange={pickCategory} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="type" value={filters.type} onChange={update}>
          <option value="">Sell or swap</option>
          <option value="sell">Available to buy</option>
          <option value="swap">Open to swap</option>
        </select>
        <input name="county" placeholder="County / city" value={filters.county} onChange={update} />
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p>Loading...</p>}
      {!loading && !error && data.listings.length === 0 && <p>No items found. Try different filters.</p>}

      <div className="grid">
        {data.listings.map((l) => <ListingCard key={l.id} listing={l} />)}
      </div>

      {data.totalPages > 1 && (
        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {data.totalPages}</span>
          <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}