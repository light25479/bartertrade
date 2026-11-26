import { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { api, API_BASE } from './api';
import { useAuth } from './AuthContext';
import Home from './pages/Home';
import Signup from './pages/Signup';
import Login from './pages/Login';
import ListingDetail from './pages/ListingDetail';
import NewListing from './pages/NewListing';
import MyListings from './pages/MyListings';
import Inbox from './pages/Inbox';
import Thread from './pages/Thread';
import Admin from './pages/Admin';
import Verify from './pages/Verify';
import VerifyEmail from './pages/VerifyEmail';
import Profile from './pages/Profile';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Rules from './pages/Rules';
import { SITE } from './siteConfig';
import Account from './pages/Account';
function RequireAuth({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}
function RequireAdmin({ children }) {
  const { user } = useAuth();
  return user && user.role === 'admin' ? children : <Navigate to="/" replace />;
}
export default function App() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
    // One live connection per logged-in user; broadcasts events to the page
  useEffect(() => {
    if (!user) return;
   const es = new EventSource(`${API_BASE}/messages/stream`, { withCredentials: true });
    es.onmessage = (e) => {
      try {
        window.dispatchEvent(new CustomEvent('bt:event', { detail: JSON.parse(e.data) }));
      } catch {
        /* ignore malformed events */
      }
    };
    return () => es.close();
  }, [user?.id]);

  // Unread badge: refresh on navigation, on live events, and once a minute as a backup
  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let stop = false;
    const tick = () =>
      api('/messages/unread-count')
        .then((d) => { if (!stop) setUnread(d.count); })
        .catch(() => {});
    const onEvent = () => setTimeout(tick, 1000);
    tick();
    const t = setInterval(tick, 60000);
    window.addEventListener('bt:event', onEvent);
    return () => {
      stop = true;
      clearInterval(t);
      window.removeEventListener('bt:event', onEvent);
    };
  }, [user, location.pathname]);
    if (loading) return <p style={{ padding: 20 }}>Loading...</p>;
  return (
    <>
            <nav>
        <Link to="/" className="brand">BarterTrade</Link>
        <button
          type="button"
          className="menu-btn"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
        <div className={`nav-links${menuOpen ? ' open' : ''}`}>
          {user ? (
            <>
              <Link to="/new">Post an item</Link>
              <Link to="/my-listings">My listings</Link>
              <Link to="/messages">Messages{unread > 0 && <span className="count">{unread}</span>}</Link>
              {user.role === 'admin' && <Link to="/admin">Admin</Link>}
              <Link to="/account">{user.name}</Link>
              <button onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up</Link>
            </>
          )}
        </div>
      </nav>
       {user && user.role !== 'admin' && (!user.email_verified || (user.phone_verification_required && !user.phone_verified)) && location.pathname !== '/verify' && (
        <div className="verify-banner">
          {!user.email_verified ? 'Please verify your email' : 'Please verify your phone number'} to post items and message people.{' '}
          <Link to="/verify">Verify now</Link>
        </div>
      )}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/new" element={<RequireAuth><NewListing /></RequireAuth>} />
          <Route path="/my-listings" element={<RequireAuth><MyListings /></RequireAuth>} />
          <Route path="/messages" element={<RequireAuth><Inbox /></RequireAuth>} />
          <Route path="/messages/:listingId/:otherId" element={<RequireAuth><Thread /></RequireAuth>} />
          <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
          <Route path="/verify" element={<RequireAuth><Verify /></RequireAuth>} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/user/:id" element={<Profile />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
        </Routes>
      </main>
            <footer>
        <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/rules">Safety &amp; rules</Link> ·{' '}
        <a href={`mailto:${SITE.contactEmail}`}>Contact</a>
      </footer>
    </>
  );
}
