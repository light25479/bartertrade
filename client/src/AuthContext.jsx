import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Reloads the full profile, including the verified flags
  const refresh = useCallback(async () => {
    try {
      const d = await api('/auth/me');
      setUser(d.user);
      return d.user;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  async function signup(form) {
    await api('/auth/signup', { method: 'POST', body: form });
    await refresh();
  }

  async function login(form) {
    await api('/auth/login', { method: 'POST', body: form });
    await refresh();
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);