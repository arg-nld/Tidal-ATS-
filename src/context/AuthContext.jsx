import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // The cached profile is display-only and is never trusted for authentication.
  // The server must validate the session token before a user is considered signed in.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const hydrateSession = async () => {
      const token = localStorage.getItem('ats_token');
      if (!token) {
        if (!cancelled) {
          setUser(null);
          localStorage.removeItem('ats_role');
          localStorage.removeItem('ats_user');
          setAuthReady(true);
        }
        return;
      }
      try {
        const res = await api.auth.getCurrentUser();
        if (!cancelled && res.user) setUser(res.user);
      } catch (err) {
        if (!cancelled) {
          setUser(null);
          localStorage.removeItem('ats_token');
          localStorage.removeItem('ats_role');
          localStorage.removeItem('ats_user');
          if (err.status !== 401) setAuthError('Unable to validate the current session. Please sign in again.');
        }
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    };
    hydrateSession();
    return () => { cancelled = true; };
  }, []);

  // Keep the displayed portal and the bearer token in sync when another tab signs in,
  // signs out, or switches accounts. Without this, the UI can show HR while requests
  // are sent with an applicant token (or vice versa), producing confusing 403 responses.
  useEffect(() => {
    let latestSync = 0;
    let disposed = false;

    const handleStorage = async event => {
      if (event.key !== 'ats_token' && event.key !== null) return;
      const syncId = ++latestSync;
      setAuthReady(false);
      const token = localStorage.getItem('ats_token');

      if (!token) {
        if (!disposed && syncId === latestSync) {
          setUser(null);
          setAuthError(null);
          setAuthReady(true);
        }
        return;
      }

      try {
        const res = await api.auth.getCurrentUser();
        if (!disposed && syncId === latestSync) {
          setUser(res.user || null);
          setAuthError(null);
        }
      } catch (err) {
        if (!disposed && syncId === latestSync) {
          setUser(null);
          localStorage.removeItem('ats_token');
          localStorage.removeItem('ats_role');
          localStorage.removeItem('ats_user');
          setAuthError(err.status === 401 ? null : 'Unable to validate the current session. Please sign in again.');
        }
      } finally {
        if (!disposed && syncId === latestSync) setAuthReady(true);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      disposed = true;
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('ats_user', JSON.stringify(user));
    } else if (authReady) {
      localStorage.removeItem('ats_token');
      localStorage.removeItem('ats_role');
      localStorage.removeItem('ats_user');
    }
  }, [user, authReady]);

  const login = useCallback(async ({ email, password }) => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await api.auth.login({ email, password });
      localStorage.setItem('ats_token', res.token);
      localStorage.setItem('ats_user', JSON.stringify(res.user));
      setUser(res.user);
      return res.user;
    } catch (err) {
      setAuthError(err.message || 'Login failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async userData => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await api.auth.register(userData);
      // Registration now stops here until the email is verified.
      setUser(null);
      localStorage.removeItem('ats_token');
      localStorage.removeItem('ats_role');
      localStorage.removeItem('ats_user');
      return res;
    } catch (err) {
      setAuthError(err.message || 'Registration failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (localStorage.getItem('ats_token')) await api.auth.logout();
    } catch {
      // Local sign-out still completes if the server is unreachable.
    } finally {
      setUser(null);
      setAuthError(null);
      localStorage.removeItem('ats_token');
      localStorage.removeItem('ats_role');
      localStorage.removeItem('ats_user');
    }
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider value={{
      user,
      role: user?.role || null,
      isHr: user?.role === 'hr',
      isApplicant: user?.role === 'applicant',
      isAuthenticated: !!user,
      loading,
      authError,
      login,
      register,
      logout,
      clearAuthError,
      authReady
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
